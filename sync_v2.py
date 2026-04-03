#!/usr/bin/env python3
"""CyberLegends Pipeline Tracker — Sheet Sync v2
Syncs HubSpot deals → Google Sheet with sections:
  Closed Won, Quote/Invoice Sent, Decision Maker Bought-In, Demo Completed,
  Closed Lost, Not Demo'd, and summary totals.
"""
import json, sys, re
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID = '1WflJ3-BDwDm3EW0wpf2O9gvyHptduN0aiIDMQdaiKlQ'
CALL_LIST_SHEET_ID = '15VS8T9m9NWqgKF5dheeHYEQ_rG-QpOvsQXGkHAIFb6Y'

# Total Ontario Value from F80 of J & C Call List (hardcoded, update when it changes)
TOTAL_ONTARIO_VALUE = 2827440.00

STAGE_MAP = {
    'appointmentscheduled': 'Appointment Scheduled',
    'presentationscheduled': 'Demo Completed',
    'decisionmakerboughtin': 'Decision Maker Bought-In',
    '103783075': 'Quote / Invoice Sent',
    '173315333': 'Board Approved',
    'contractsent': 'Roll-Out / Sign-Up',
    '1061869403': 'Closed Won - Pilot',
    'closedwon': 'Closed Won',
    'closedlost': 'Closed Lost',
}

# Pipeline sections in display order (Closed Lost and Not Demo'd handled separately)
SECTION_ORDER = ['Closed Won', 'Quote / Invoice Sent', 'Decision Maker Bought-In', 'Demo Completed', 'Appointment Scheduled']

STAGE_TO_SECTION = {
    'Closed Won': 'Closed Won', 'Closed Won - Pilot': 'Closed Won',
    'Board Approved': 'Quote / Invoice Sent', 'Roll-Out / Sign-Up': 'Closed Won',
    'Quote / Invoice Sent': 'Quote / Invoice Sent',
    'Decision Maker Bought-In': 'Decision Maker Bought-In',
    'Demo Completed': 'Demo Completed',
    'Appointment Scheduled': 'Appointment Scheduled',
    'Closed Lost': 'Closed Lost',
}

HEADERS = ['#', 'Board Name', 'Board Type', 'Deal Stage', 'Deal Value (CAD)', 'Stage Date', 'HubSpot Deal ID', 'Last Contacted', 'Onboarding Status']
NUM_COLS = len(HEADERS)

# Non-Ontario boards to exclude from pipeline (Alberta, Manitoba, Quebec, single schools, orgs)
NON_ONTARIO_BOARDS = {
    'greater st. albert roman catholic separate school division',
    'lord selkirk school division',
    'fort mcmurray public school division',
    # 'protestant separate school board',  # Removed — has a 2026 closed deal in HubSpot
    'parkdale elementary school',
    'new frontiers school board - mary gardner school',
    'new frontiers school board',
    '7 oaks school div',
    'calgary board of education',
    'chaparral school',
    'citadel park school',
    'elboya school',
    'hidden valley school',
    'woodlands school',
    'peace wapiti public school division',
    'lakeshore school division',
    'st. paul education regional division',
    'clearview public schools',
    'golden hills school division',
    'golden hills school division - greentree school k-6',
    'arthur ford public school',
    'alexandra public school',
    'ictc',
    'ahkwesahsne mohawk board of education',
    'biidaaban kinoomaagegamik school',
    'migizi wazisin elementary school',
    'walpole island elementary school',
}

# Manual Closed Lost overrides — boards to force into Closed Lost section
# (e.g. boards where the HubSpot deal is outside school year filter or missing)
# Format: normalized_key -> (display_name, value)
MANUAL_CLOSED_LOST = {
    'kawartha pine ridge district school board': ('Kawartha Pine Ridge District School Board', 51170.00),
    'district school board of niagara': ('District School Board of Niagara', 57715.00),
}

# Known aliases: call list name -> normalized HubSpot deal name
CALL_LIST_ALIASES = {
    'kenora catholic dsb': 'kenora catholic district school board',
    'northwest catholic dsb': None,  # no deal
    'huron-perth catholic dsb': 'huron perth catholic district school board',
    'huron-superior catholic dsb': None,
    'superior-greenstone district school board': 'superior greenstone district school board',
    'algonquin & lakeshore catholic district school board': 'algonquin and lakeshore catholic district school board',
    'catholic district school board of eastern ontario': 'catholic dsb of eastern ontario',
    'nipissing parry sound catholic district school board': 'nipissing-parry sound catholic district school board',
    'conseil scolaire de district catholique des aurores boreales': None,
    'conseil scolaire de district catholique franco-nord': None,
    'conseil scolaire public du grand nord de l\'ontario': 'conseil scolaire du grand nord',
    'conseil des ecoles publiques de l\'est de l\'ontario': None,
    'conseil scolaire de district catholique du nouvel-ontario': None,
    'conseil scolaire de district catholique du centre-est de l\'ontario': None,
    'conseil scolaire viamonde': None,
    'conseil scolaire de district catholique de l\'est ontarien': None,
    'conseil scolaire catholique monavenir': 'conseil scolaire catholique monavenir',
    'le conseil scolaire catholique de district des grandes rivières': 'conseil scolaire catholique des grandes rivières',
    'conseil scolaire catholique providence': 'csc providence',
    'district school board of ontario north east': None,
    'toronto catholic district school board': None,
    'dufferin-peel catholic district school board': None,
    'hamilton-wentworth district school board': None,
    'moosonee district school board': None,
}

# Last Contacted dates for Not Demo'd boards (from HubSpot company records)
# Maps call list board name (lowercased, exact match) → ISO date string
NOTDEMOD_LAST_CONTACTED = {
    'toronto catholic district school board': '2024-10-09T15:15:36Z',
    'dufferin-peel catholic district school board': '2026-03-18T00:00:00Z',
    'hamilton-wentworth district school board': '2026-03-09T00:00:00Z',
    'hamilton wentworth catholic district board': '2026-03-02T02:26:45Z',
    'halton district school board': '2026-01-27T00:00:00Z',
    'simcoe county district school board': '2026-03-11T00:00:00Z',
    'upper canada district school board': '2026-01-27T00:00:00Z',
    'upper grand district school board': '2026-01-20T00:00:00Z',
    'grand erie district school board': '2026-02-25T00:00:00Z',
    'lambton kent district school board': '2026-02-03T00:00:00Z',
    'simcoe muskoka catholic district school board': '2026-01-27T00:00:00Z',
    'district school board of ontario north east': '2026-01-21T00:00:00Z',
    'peterborough victoria northumberland and clarington catholic district school board': '2026-01-21T00:00:00Z',
    'near north district school board': '2026-01-22T00:00:00Z',
    'brant haldimand norfolk catholic district school board': '2026-01-22T00:00:00Z',
    'st. clair catholic district school board': '2026-01-23T16:21:56Z',
    'sudbury catholic district school board': '2025-12-09T00:00:00Z',
    'keewatin patricia district school board': '2025-11-19T00:00:00Z',
    'huron-superior catholic dsb': '2025-12-09T00:00:00Z',
    'thunder bay catholic district school board': '2025-12-09T00:00:00Z',
    'conseil scolaire de district catholique du centre-est de l\'ontario': '2024-10-09T15:15:36Z',
    'conseil scolaire de district catholique de l\'est ontarien': '2026-03-02T02:26:45Z',
    'conseil scolaire de district catholique du nouvel-ontario': '2023-06-20T20:11:10Z',
    'conseil scolaire de district catholique des aurores boreales': '2026-01-27T17:36:42Z',
    'conseil scolaire de district catholique franco-nord': '2026-01-22T20:55:24Z',
    'conseil scolaire public du grand nord de l\'ontario': '2025-11-20T16:11:22Z',
    'rainy river district school board': '2026-03-11T14:58:03Z',
    'northwest catholic dsb': '2025-12-09T19:10:58Z',
    'moosonee district school board': '2025-12-09T16:18:45Z',
    'nipissing parry sound catholic district school board': '2025-12-09T17:33:22Z',
}


def normalize_board_name(name):
    s = name.lower().strip()
    s = re.sub(r'\s*[-\u2013\u2014]\s*(cyber\s+legends?|cl\s+).*$', '', s)
    s = re.sub(r'\s*(licenses?|licences?|renewal|pilot|extension|platform|teaching|resources?|free|new\s+deal|teacher\s+trial)\b.*$', '', s)
    s = re.sub(r'\s*[-\u2013\u2014]\s*\d+\s+year\b.*$', '', s)
    s = re.sub(r'\s*\d{4}[/\-]\d{4}\s*$', '', s)
    s = re.sub(r'\s*\d{4}\s*$', '', s)
    s = s.replace('\u2019', "'").replace('\u2018', "'")
    return s.strip(' -\u2013\u2014')


def normalize_call_list_name(name):
    """Normalize a name from the call list for matching against pipeline boards."""
    s = name.lower().strip()
    # Normalize common variations
    s = s.replace('&', 'and')
    s = s.replace(' dsb', ' district school board')
    s = s.replace('-', '-')  # keep hyphens
    s = s.replace('\u2019', "'").replace('\u2018', "'")
    return s


def pick_best_deal(deals):
    if len(deals) == 1:
        return deals[0]
    non_lost = [d for d in deals if d.get('stage', '').lower().strip() != 'closedlost']
    pool = non_lost if non_lost else deals
    # Prefer closedwon deal with closedate in 2026 (matches HubSpot "Closed 2026" view)
    won_2026 = [d for d in pool if d.get('stage', '').lower().strip() in ('closedwon', 'contractsent', '1061869403')
                and (d.get('closedate', '') or '')[:4] == '2026']
    if won_2026:
        return max(won_2026, key=lambda d: float(d.get('amount', 0) or 0))
    return max(pool, key=lambda d: float(d.get('amount', 0) or 0))


def format_date(iso_str):
    if not iso_str:
        return ''
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        formatted = dt.strftime('%b %-d, %Y')
        # Prefix with ' to prevent Google Sheets from auto-parsing as date
        return "'" + formatted
    except:
        return iso_str[:10] if iso_str else ''


def detect_board_type(name):
    nl = name.lower()
    if any(x in nl for x in ['catholic', 'cdsb', 'csc ', 'conseil scolaire catholique']):
        return 'Catholic'
    if 'separate' in nl:
        return 'Other'
    if 'conseil' in nl:
        return 'French'
    return 'Public'


def clean_display_name(name):
    d = name
    d = re.sub(r'\s*[-\u2013\u2014]\s*(Cyber\s+Legends|CL\s+|Teaching\s+Platform|New\s+Deal|Free\s+Pilot|Renewal|Pilot|Cl\s+).*$', '', d, flags=re.IGNORECASE)
    d = re.sub(r'\s*[-\u2013\u2014]\s*\d{4}[/\-]\d{4}.*$', '', d)
    d = re.sub(r'\s*[-\u2013\u2014]\s*(CL\s+)?Licen[sc]es?.*$', '', d, flags=re.IGNORECASE)
    d = re.sub(r'\s*[-\u2013\u2014]\s*\d{4}.*$', '', d)
    d = re.sub(r'\s*[-\u2013\u2014]\s*\d+\s+Year.*$', '', d, flags=re.IGNORECASE)
    d = re.sub(r'\s+Renewal\s*\d{4}[/\-]\d{4}\s*$', '', d, flags=re.IGNORECASE)
    d = re.sub(r'\s*[-\u2013\u2014]\s*Teacher\s+Trial.*$', '', d, flags=re.IGNORECASE)
    return d.strip(' -\u2013\u2014')


def parse_dollar(val):
    """Parse dollar string like '$2,827,440.00' to float."""
    if not val:
        return 0.0
    try:
        return float(val.replace('$', '').replace(',', ''))
    except:
        return 0.0


def read_call_list(gc):
    """Read the J & C Call List to get Ontario board names and values."""
    sh = gc.open_by_key(CALL_LIST_SHEET_ID)
    ws = sh.worksheet('J & C Call List')
    rows = ws.get_all_values()

    # Header at row 4 (index 3): J or C, Company name, Elementary, Elem Value, Highschools, Total $, ...
    boards = []
    for i in range(4, min(79, len(rows))):  # rows 5-79
        r = rows[i]
        name = r[1].strip() if len(r) > 1 else ''
        total = r[5].strip() if len(r) > 5 else ''
        if name:
            boards.append({
                'name': name,
                'total_value': parse_dollar(total),
                'total_value_str': total,
            })

    return boards


def _normalize_for_compare(s):
    """Extra normalization for comparison: strip hyphens, expand DSB, lowercase."""
    s = s.replace('-', ' ').replace('&', 'and')
    s = re.sub(r'\bdsb\b', 'district school board', s)
    s = re.sub(r'\bcdsb\b', 'catholic district school board', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def match_call_list_to_pipeline(call_list_boards, pipeline_board_keys):
    """Determine which call list boards are NOT in the pipeline.
    Returns list of boards from call list that haven't been demo'd.
    """
    not_demod = []
    matched = []

    # Pre-compute expanded pipeline keys for comparison
    pk_expanded = {}
    for pk in pipeline_board_keys:
        pk_expanded[pk] = _normalize_for_compare(pk)

    for board in call_list_boards:
        cl_norm = normalize_call_list_name(board['name'])
        cl_norm2 = normalize_board_name(board['name'])
        cl_raw_lower = board['name'].lower().strip()

        # Check aliases using multiple forms of the name
        alias_found = False
        for lookup_key in [cl_norm, cl_norm2, cl_raw_lower]:
            if lookup_key in CALL_LIST_ALIASES:
                alias = CALL_LIST_ALIASES[lookup_key]
                if alias is not None and alias in pipeline_board_keys:
                    matched.append(board['name'])
                    alias_found = True
                    break
                elif alias is None:
                    # Explicitly marked as not in pipeline — skip alias, try direct
                    break
        if alias_found:
            continue

        # Direct match using multiple normalization strategies
        found = False
        cl_compare = _normalize_for_compare(cl_norm)
        cl_compare2 = _normalize_for_compare(cl_norm2)

        for pk, pk_exp in pk_expanded.items():
            # Exact match (original forms)
            if cl_norm2 == pk or cl_norm == pk:
                found = True
                break
            # Exact match (expanded/normalized forms)
            if cl_compare == pk_exp or cl_compare2 == pk_exp:
                found = True
                break
            # Substring containment (expanded forms)
            if cl_compare in pk_exp or pk_exp in cl_compare:
                found = True
                break
            if cl_compare2 in pk_exp or pk_exp in cl_compare2:
                found = True
                break

        if found:
            matched.append(board['name'])
        else:
            not_demod.append(board)

    return not_demod, matched


def main():
    data = json.loads(sys.stdin.read())
    creds_path = data.get('creds_path', '/tmp/sa.json')
    date = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    source = data.get('source_agent', 'sheet-sync')
    deals = data.get('deals', [])
    company_activity = data.get('company_activity', {})

    if not deals:
        print(json.dumps({'status': 'error', 'message': 'No deals provided'}))
        return

    # Filter to Sales Pipeline only
    sales_deals = [d for d in deals if d.get('pipeline', '') == 'default' and d.get('name', '').strip()]
    print(f"[DEBUG] {len(sales_deals)} Sales Pipeline deals from {len(deals)} total", file=sys.stderr)

    # Group by normalized board name & pick best deal
    board_groups = {}
    for d in sales_deals:
        key = normalize_board_name(d.get('name', ''))
        if not key:
            continue
        board_groups.setdefault(key, []).append(d)

    best_deals = []
    for key, group in board_groups.items():
        best = pick_best_deal(group)
        best['_board_key'] = key
        best_deals.append(best)
    print(f"[DEBUG] {len(best_deals)} unique boards after dedup", file=sys.stderr)

    # Filter to current school year
    SCHOOL_YEAR_START = '2025-09-01'
    SCHOOL_YEAR_END = '2026-08-31'

    def in_school_year(d):
        # Filter to deals created in 2026 — matches HubSpot "All Active Cyber Legends Deals clone" view
        cd = d.get('createdate', '') or ''
        if not cd:
            return True
        try:
            return cd[:4] == '2026'
        except:
            return True

    before_filter = len(best_deals)
    best_deals = [d for d in best_deals if in_school_year(d)]
    print(f"[DEBUG] {len(best_deals)} boards in school year 2025-2026 (filtered {before_filter - len(best_deals)})", file=sys.stderr)

    # Remove non-Ontario boards
    before_ont = len(best_deals)
    best_deals = [d for d in best_deals if d.get('_board_key', '') not in NON_ONTARIO_BOARDS]
    print(f"[DEBUG] {len(best_deals)} Ontario boards (removed {before_ont - len(best_deals)} non-Ontario)", file=sys.stderr)

    # Categorize into sections (including Closed Lost now)
    sections = {s: [] for s in SECTION_ORDER}
    sections['Closed Lost'] = []
    for d in best_deals:
        stage_raw = d.get('stage', '').lower().strip()
        stage_label = STAGE_MAP.get(stage_raw, stage_raw)
        section = STAGE_TO_SECTION.get(stage_label)
        if section and section in sections:
            sections[section].append(d)

    # Add manual Closed Lost overrides
    for board_key, (display_name, board_value) in MANUAL_CLOSED_LOST.items():
        # Skip if already in pipeline from HubSpot
        already_in = False
        for sec_deals in sections.values():
            for d in sec_deals:
                if d.get('_board_key', '') == board_key:
                    already_in = True
                    break
            if already_in:
                break
        if not already_in:
            sections['Closed Lost'].append({
                'name': display_name,
                'amount': board_value,
                'stage': 'closedlost',
                'stage_date': '',
                'id': '',
                '_board_key': board_key,
                '_manual': True,
            })
            print(f"[DEBUG] Added manual Closed Lost: {display_name} (${board_value:,.0f})", file=sys.stderr)

    for sec in sections:
        sections[sec].sort(key=lambda d: float(d.get('amount', 0) or 0), reverse=True)

    # --- Connect to sheet ---
    creds = Credentials.from_service_account_file(creds_path, scopes=[
        'https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'
    ])
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SHEET_ID)
    ws = sh.worksheet('Pipeline Tracker')

    old_rows = ws.get_all_values()
    total_cols = ws.col_count
    print(f"[DEBUG] Sheet dimensions: {ws.row_count}x{total_cols}", file=sys.stderr)

    # Read old onboarding status + deal data for change detection
    old_onboarding = {}
    old_deal_map = {}
    old_hi = next((i for i, r in enumerate(old_rows) if 'Board Name' in r), None)
    if old_hi is not None:
        hdr = old_rows[old_hi]
        bc = hdr.index('Board Name') if 'Board Name' in hdr else None
        oc = hdr.index('Onboarding Status') if 'Onboarding Status' in hdr else None
        sc = hdr.index('Deal Stage') if 'Deal Stage' in hdr else None
        vc = next((i for i, h in enumerate(hdr) if h == 'Deal Value (CAD)'), None)
        if bc is not None:
            skip = ('CLOSED', 'QUOTE', 'DEMO', 'DECISION', 'APPOINTMENT', 'TOTAL', 'OPEN', 'LAST', 'NOT DEMO', 'NON-DEMO')
            for r in old_rows[old_hi + 1:]:
                if len(r) <= bc or not r[bc].strip() or r[bc].strip().upper().startswith(skip):
                    continue
                key = normalize_board_name(r[bc])
                if oc and len(r) > oc and r[oc].strip():
                    old_onboarding[key] = r[oc].strip()
                if sc and vc:
                    old_deal_map[key] = {
                        'stage': r[sc].strip() if len(r) > sc else '',
                        'value': r[vc].strip() if len(r) > vc else '',
                        'name': r[bc].strip(),
                    }

    # --- Read call list for "Not Demo'd" section ---
    print("[DEBUG] Reading J & C Call List for Not Demo'd boards...", file=sys.stderr)
    call_list_boards = read_call_list(gc)
    print(f"[DEBUG] {len(call_list_boards)} boards in call list", file=sys.stderr)

    # Build set of all pipeline board keys (all sections including Closed Lost + manual overrides)
    pipeline_board_keys = set()
    for d in best_deals:
        pipeline_board_keys.add(d.get('_board_key', ''))
    # Include manual closed lost so they're excluded from Not Demo'd
    for mk in MANUAL_CLOSED_LOST:
        pipeline_board_keys.add(mk)

    not_demod_boards, matched_boards = match_call_list_to_pipeline(call_list_boards, pipeline_board_keys)
    print(f"[DEBUG] {len(matched_boards)} call list boards matched to pipeline, {len(not_demod_boards)} not demo'd", file=sys.stderr)

    # --- Build new rows ---
    def pad(row):
        out = []
        for c in row:
            if isinstance(c, str) and c.startswith('='):
                out.append(c)
            elif isinstance(c, (int, float)):
                out.append(c)
            else:
                out.append(str(c) if c is not None else '')
        return out + [''] * (total_cols - len(out))

    all_rows = []
    all_rows.append(pad(['Cyber Legends \u2014 Ontario Board Pipeline Tracker (2025\u20132026 School Year)']))
    all_rows.append(pad([f'Last Updated: {date} | Source: HubSpot CRM (Auto-synced by {source})']))
    all_rows.append(pad([]))  # spacer
    all_rows.append(pad(HEADERS))

    row_num = 1
    section_start_rows = {}
    section_value_rows = {}
    data_row_indices = []
    first_section = True

    # --- Pipeline sections (Closed Won, Quote, DMBI, Demo, Appointment) ---
    for section_name in SECTION_ORDER:
        section_deals = sections[section_name]
        if not section_deals and section_name in ('Decision Maker Bought-In', 'Appointment Scheduled'):
            continue

        if not first_section:
            all_rows.append(pad([]))
        first_section = False

        section_total = sum(float(d.get('amount', 0) or 0) for d in section_deals)
        section_start_rows[section_name] = len(all_rows)
        count = len([d for d in section_deals if clean_display_name(d.get('name', '')).strip()])
        all_rows.append(pad([f'{section_name.upper()}', '', '', f'{count} boards', section_total]))

        value_rows = []
        for d in section_deals:
            display_name = clean_display_name(d.get('name', ''))
            if not display_name.strip():
                continue
            stage_raw = d.get('stage', '').lower().strip()
            stage_label = STAGE_MAP.get(stage_raw, stage_raw)
            amount = float(d.get('amount', 0) or 0)
            stage_date = format_date(d.get('stage_date', ''))
            board_key = d.get('_board_key', '')
            last_contacted = format_date(company_activity.get(board_key, ''))
            onboard = old_onboarding.get(board_key, '') if section_name == 'Closed Won' else ''

            row_idx = len(all_rows)
            value_rows.append(row_idx + 1)
            data_row_indices.append(row_idx)
            all_rows.append(pad([
                str(row_num), display_name, detect_board_type(d.get('name', '')),
                stage_label, amount, stage_date, str(d.get('id', '')), last_contacted, onboard,
            ]))
            row_num += 1

        section_value_rows[section_name] = value_rows

    # --- Closed Lost section ---
    closed_lost_deals = sections.get('Closed Lost', [])
    if closed_lost_deals:
        all_rows.append(pad([]))  # spacer
        section_name = 'Closed Lost'
        cl_total = sum(float(d.get('amount', 0) or 0) for d in closed_lost_deals)
        section_start_rows[section_name] = len(all_rows)
        count = len([d for d in closed_lost_deals if clean_display_name(d.get('name', '')).strip()])
        all_rows.append(pad([f'{section_name.upper()}', '', '', f'{count} boards', cl_total]))

        cl_value_rows = []
        for d in closed_lost_deals:
            display_name = clean_display_name(d.get('name', ''))
            if not display_name.strip():
                continue
            stage_raw = d.get('stage', '').lower().strip()
            stage_label = STAGE_MAP.get(stage_raw, stage_raw)
            amount = float(d.get('amount', 0) or 0)
            stage_date = format_date(d.get('stage_date', ''))
            board_key = d.get('_board_key', '')
            last_contacted = format_date(company_activity.get(board_key, ''))

            row_idx = len(all_rows)
            cl_value_rows.append(row_idx + 1)
            data_row_indices.append(row_idx)
            all_rows.append(pad([
                str(row_num), display_name, detect_board_type(d.get('name', '')),
                stage_label, amount, stage_date, str(d.get('id', '')), last_contacted, '',
            ]))
            row_num += 1
        section_value_rows['Closed Lost'] = cl_value_rows
    else:
        section_start_rows['Closed Lost'] = len(all_rows)
        all_rows.append(pad([]))
        all_rows.append(pad(['CLOSED LOST', '', '', '0 boards', 0]))
        section_value_rows['Closed Lost'] = []

    # --- Not Demo'd section ---
    all_rows.append(pad([]))  # spacer
    section_name = "Not Demo'd"
    nd_total = sum(b['total_value'] for b in not_demod_boards)
    section_start_rows[section_name] = len(all_rows)
    all_rows.append(pad([f"NOT DEMO'D", '', '', f'{len(not_demod_boards)} boards', nd_total]))

    nd_value_rows = []
    not_demod_boards.sort(key=lambda b: b['total_value'], reverse=True)
    for b in not_demod_boards:
        row_idx = len(all_rows)
        nd_value_rows.append(row_idx + 1)
        data_row_indices.append(row_idx)
        # Look up Last Contacted from hardcoded company data
        # Normalize curly apostrophes to straight for matching
        board_name_lower = b['name'].lower().strip().replace('\u2019', "'").replace('\u2018', "'")
        last_contacted_iso = NOTDEMOD_LAST_CONTACTED.get(board_name_lower, '')
        # Also check company_activity with normalized key
        if not last_contacted_iso:
            norm_key = normalize_board_name(b['name'])
            last_contacted_iso = company_activity.get(norm_key, '')
        last_contacted = format_date(last_contacted_iso)
        all_rows.append(pad([
            str(row_num), b['name'], detect_board_type(b['name']),
            "Not Demo'd", b['total_value'], '', '', last_contacted, '',
        ]))
        row_num += 1
    section_value_rows[section_name] = nd_value_rows

    # --- TOTALS ---
    all_rows.append(pad([]))  # spacer

    # Collect value rows for formulas
    all_pipeline_val = []  # All pipeline sections (Won + Quote + DMBI + Demo + Appt)
    for sn in SECTION_ORDER:
        all_pipeline_val.extend(section_value_rows.get(sn, []))

    won_val_rows = section_value_rows.get('Closed Won', [])
    cl_val_rows = section_value_rows.get('Closed Lost', [])
    nd_val_rows = section_value_rows.get("Not Demo'd", [])

    total_f = '+'.join([f'E{r}' for r in all_pipeline_val]) if all_pipeline_val else '0'
    won_f = '+'.join([f'E{r}' for r in won_val_rows]) if won_val_rows else '0'
    cl_f = '+'.join([f'E{r}' for r in cl_val_rows]) if cl_val_rows else '0'

    t_row = len(all_rows) + 1
    all_rows.append(pad(['TOTAL PIPELINE VALUE', '', '', '', f'={total_f}']))
    w_row = len(all_rows) + 1
    all_rows.append(pad(['CLOSED WON TOTAL', '', '', '', f'={won_f}']))
    o_row = len(all_rows) + 1
    all_rows.append(pad(['OPEN PIPELINE (excl. Won)', '', '', '', f'=E{t_row}-E{w_row}']))
    clost_row = len(all_rows) + 1
    all_rows.append(pad([f'CLOSED LOST TOTAL ({len(closed_lost_deals)} boards)', '', '', '', f'={cl_f}']))

    # Non-demo'd Total Value = Total Ontario Value - Closed Won - Open Pipeline - Closed Lost
    nd_total_row = len(all_rows) + 1
    all_rows.append(pad(["NON-DEMO'D TOTAL VALUE", '', '', '', f'={TOTAL_ONTARIO_VALUE}-E{w_row}-E{o_row}-E{clost_row}']))

    # Pad remaining rows with blanks
    target_rows = max(len(all_rows), len(old_rows), 60)
    while len(all_rows) < target_rows:
        all_rows.append(pad([]))

    # --- WRITE ---
    print(f"[DEBUG] Removing merged cells and filters before write", file=sys.stderr)
    sheet_id = ws.id

    prep_requests = []
    sheet_meta = sh.fetch_sheet_metadata()
    for s_meta in sheet_meta.get('sheets', []):
        if s_meta.get('properties', {}).get('sheetId') == sheet_id:
            for m in s_meta.get('merges', []):
                prep_requests.append({'unmergeCells': {'range': m}})
            if s_meta.get('basicFilter'):
                prep_requests.append({'clearBasicFilter': {'sheetId': sheet_id}})
            break

    if prep_requests:
        sh.batch_update({'requests': prep_requests})

    ws.clear()
    import time
    time.sleep(0.5)

    end_col = chr(64 + min(total_cols, 26))
    CHUNK = 200
    for start in range(0, len(all_rows), CHUNK):
        chunk = all_rows[start:start + CHUNK]
        r1 = start + 1
        r2 = start + len(chunk)
        ws.update(values=chunk, range_name=f'A{r1}:{end_col}{r2}', value_input_option='USER_ENTERED')
    print("[DEBUG] Write complete", file=sys.stderr)

    # --- Formatting ---
    format_requests = []
    WHITE = {'red': 1, 'green': 1, 'blue': 1}
    ZEBRA = {'red': 0.96, 'green': 0.97, 'blue': 0.98}
    HEADER_BG = {'red': 0.22, 'green': 0.26, 'blue': 0.32}
    HEADER_FG = {'red': 1, 'green': 1, 'blue': 1}
    WON_BG = {'red': 0.85, 'green': 0.94, 'blue': 0.87}
    WON_FG = {'red': 0.13, 'green': 0.35, 'blue': 0.16}
    QUOTE_BG = {'red': 0.90, 'green': 0.91, 'blue': 0.96}
    QUOTE_FG = {'red': 0.25, 'green': 0.25, 'blue': 0.45}
    DEMO_BG = {'red': 0.95, 'green': 0.92, 'blue': 0.85}
    DEMO_FG = {'red': 0.45, 'green': 0.30, 'blue': 0.10}
    APPT_BG = {'red': 0.93, 'green': 0.93, 'blue': 0.93}
    APPT_FG = {'red': 0.3, 'green': 0.3, 'blue': 0.3}
    LOST_BG = {'red': 0.95, 'green': 0.87, 'blue': 0.87}
    LOST_FG = {'red': 0.55, 'green': 0.15, 'blue': 0.15}
    ND_BG = {'red': 0.92, 'green': 0.92, 'blue': 0.95}
    ND_FG = {'red': 0.35, 'green': 0.35, 'blue': 0.50}
    TOTAL_BG = {'red': 0.22, 'green': 0.26, 'blue': 0.32}
    TOTAL_FG = {'red': 1, 'green': 1, 'blue': 1}

    SECTION_COLORS = {
        'Closed Won': (WON_BG, WON_FG),
        'Quote / Invoice Sent': (QUOTE_BG, QUOTE_FG),
        'Decision Maker Bought-In': (QUOTE_BG, QUOTE_FG),
        'Demo Completed': (DEMO_BG, DEMO_FG),
        'Appointment Scheduled': (APPT_BG, APPT_FG),
        'Closed Lost': (LOST_BG, LOST_FG),
        "Not Demo'd": (ND_BG, ND_FG),
    }

    def cell_range(r1, c1, r2, c2):
        return {'sheetId': sheet_id, 'startRowIndex': r1 - 1, 'endRowIndex': r2, 'startColumnIndex': c1 - 1, 'endColumnIndex': c2}

    def solid_border(style='SOLID', color=None):
        return {'style': style, 'width': 1, 'color': color or {'red': 0.8, 'green': 0.8, 'blue': 0.8}}

    # Global white bg + font
    format_requests.append({'repeatCell': {'range': cell_range(1, 1, len(all_rows), 9), 'cell': {'userEnteredFormat': {'backgroundColor': WHITE, 'textFormat': {'fontSize': 10, 'fontFamily': 'Inter'}, 'verticalAlignment': 'MIDDLE'}}, 'fields': 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)'}})
    # Currency format col E
    format_requests.append({'repeatCell': {'range': cell_range(1, 5, len(all_rows), 5), 'cell': {'userEnteredFormat': {'numberFormat': {'type': 'CURRENCY', 'pattern': '$#,##0'}}}, 'fields': 'userEnteredFormat.numberFormat'}})
    # Plain text format for Last Contacted col H (prevent date auto-formatting)
    format_requests.append({'repeatCell': {'range': cell_range(1, 8, len(all_rows), 8), 'cell': {'userEnteredFormat': {'numberFormat': {'type': 'TEXT'}}}, 'fields': 'userEnteredFormat.numberFormat'}})
    # Title
    format_requests.append({'repeatCell': {'range': cell_range(1, 1, 1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 16, 'fontFamily': 'Inter'}}}, 'fields': 'userEnteredFormat.textFormat'}})
    # Subtitle
    format_requests.append({'repeatCell': {'range': cell_range(2, 1, 2, 9), 'cell': {'userEnteredFormat': {'textFormat': {'fontSize': 9, 'foregroundColor': {'red': 0.5, 'green': 0.5, 'blue': 0.5}}}}, 'fields': 'userEnteredFormat.textFormat'}})
    # Column headers
    format_requests.append({'repeatCell': {'range': cell_range(4, 1, 4, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 10, 'foregroundColor': HEADER_FG, 'fontFamily': 'Inter'}, 'backgroundColor': HEADER_BG, 'padding': {'top': 6, 'bottom': 6}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})
    # Freeze
    format_requests.append({'updateSheetProperties': {'properties': {'sheetId': sheet_id, 'gridProperties': {'frozenRowCount': 4}}, 'fields': 'gridProperties.frozenRowCount'}})

    # Section headers
    for sn, ri in section_start_rows.items():
        r1 = ri + 1
        bg, fg = SECTION_COLORS.get(sn, (APPT_BG, APPT_FG))
        format_requests.append({'repeatCell': {'range': cell_range(r1, 1, r1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 11, 'foregroundColor': fg, 'fontFamily': 'Inter'}, 'backgroundColor': bg, 'padding': {'top': 8, 'bottom': 4}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})
        format_requests.append({'updateBorders': {'range': cell_range(r1, 1, r1, 9), 'bottom': solid_border('SOLID_MEDIUM', fg)}})

    # Zebra striping
    for idx, row_idx in enumerate(data_row_indices):
        if idx % 2 == 1:
            format_requests.append({'repeatCell': {'range': cell_range(row_idx + 1, 1, row_idx + 1, 9), 'cell': {'userEnteredFormat': {'backgroundColor': ZEBRA}}, 'fields': 'userEnteredFormat.backgroundColor'}})

    # Total rows
    for i in range(len(all_rows)):
        r = all_rows[i]
        if r[0] == 'TOTAL PIPELINE VALUE':
            format_requests.append({'repeatCell': {'range': cell_range(i + 1, 1, i + 1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 11, 'foregroundColor': TOTAL_FG, 'fontFamily': 'Inter'}, 'backgroundColor': TOTAL_BG, 'padding': {'top': 6, 'bottom': 6}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})
        elif r[0] == 'CLOSED WON TOTAL':
            format_requests.append({'repeatCell': {'range': cell_range(i + 1, 1, i + 1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 10, 'foregroundColor': WON_FG}, 'backgroundColor': WON_BG, 'padding': {'top': 4, 'bottom': 4}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})
        elif r[0] == 'OPEN PIPELINE (excl. Won)':
            format_requests.append({'repeatCell': {'range': cell_range(i + 1, 1, i + 1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 10, 'foregroundColor': QUOTE_FG}, 'backgroundColor': QUOTE_BG, 'padding': {'top': 4, 'bottom': 4}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})
        elif isinstance(r[0], str) and r[0].startswith('CLOSED LOST TOTAL'):
            format_requests.append({'repeatCell': {'range': cell_range(i + 1, 1, i + 1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 10, 'foregroundColor': LOST_FG}, 'backgroundColor': LOST_BG, 'padding': {'top': 4, 'bottom': 4}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})
        elif r[0] == "NON-DEMO'D TOTAL VALUE":
            format_requests.append({'repeatCell': {'range': cell_range(i + 1, 1, i + 1, 9), 'cell': {'userEnteredFormat': {'textFormat': {'bold': True, 'fontSize': 10, 'foregroundColor': ND_FG}, 'backgroundColor': ND_BG, 'padding': {'top': 4, 'bottom': 4}}}, 'fields': 'userEnteredFormat(textFormat,backgroundColor,padding)'}})

    # Column widths
    for ci, px in [(0, 35), (1, 420), (2, 90), (3, 170), (4, 140), (5, 120), (6, 130), (7, 130), (8, 150)]:
        format_requests.append({'updateDimensionProperties': {'range': {'sheetId': sheet_id, 'dimension': 'COLUMNS', 'startIndex': ci, 'endIndex': ci + 1}, 'properties': {'pixelSize': px}, 'fields': 'pixelSize'}})
    # Section header row heights
    for sn, ri in section_start_rows.items():
        format_requests.append({'updateDimensionProperties': {'range': {'sheetId': sheet_id, 'dimension': 'ROWS', 'startIndex': ri, 'endIndex': ri + 1}, 'properties': {'pixelSize': 32}, 'fields': 'pixelSize'}})
    # Column header row height
    format_requests.append({'updateDimensionProperties': {'range': {'sheetId': sheet_id, 'dimension': 'ROWS', 'startIndex': 3, 'endIndex': 4}, 'properties': {'pixelSize': 30}, 'fields': 'pixelSize'}})
    # Right-align number columns
    for col_idx in [0, 4]:
        format_requests.append({'repeatCell': {'range': cell_range(5, col_idx + 1, len(all_rows), col_idx + 1), 'cell': {'userEnteredFormat': {'horizontalAlignment': 'RIGHT'}}, 'fields': 'userEnteredFormat.horizontalAlignment'}})
    # Center Board Type
    format_requests.append({'repeatCell': {'range': cell_range(5, 3, len(all_rows), 3), 'cell': {'userEnteredFormat': {'horizontalAlignment': 'CENTER'}}, 'fields': 'userEnteredFormat.horizontalAlignment'}})

    sh.batch_update({'requests': format_requests})
    print("[DEBUG] Formatting complete", file=sys.stderr)

    # --- Merge cells so labels aren't cut off ---
    merge_requests = []
    # Title row (row 1): merge A:I
    merge_requests.append({'mergeCells': {'range': {'sheetId': sheet_id, 'startRowIndex': 0, 'endRowIndex': 1, 'startColumnIndex': 0, 'endColumnIndex': 9}, 'mergeType': 'MERGE_ALL'}})
    # Subtitle row (row 2): merge A:I
    merge_requests.append({'mergeCells': {'range': {'sheetId': sheet_id, 'startRowIndex': 1, 'endRowIndex': 2, 'startColumnIndex': 0, 'endColumnIndex': 9}, 'mergeType': 'MERGE_ALL'}})
    # Section headers: merge A:C (keep D for count, E for value)
    for sn, ri in section_start_rows.items():
        merge_requests.append({'mergeCells': {'range': {'sheetId': sheet_id, 'startRowIndex': ri, 'endRowIndex': ri + 1, 'startColumnIndex': 0, 'endColumnIndex': 3}, 'mergeType': 'MERGE_ALL'}})
    # Summary/total rows: merge A:D (keep E for value)
    for i, r in enumerate(all_rows):
        if isinstance(r[0], str) and r[0] in ('TOTAL PIPELINE VALUE', 'CLOSED WON TOTAL', 'OPEN PIPELINE (excl. Won)', "NON-DEMO'D TOTAL VALUE") or (isinstance(r[0], str) and r[0].startswith('CLOSED LOST TOTAL')):
            merge_requests.append({'mergeCells': {'range': {'sheetId': sheet_id, 'startRowIndex': i, 'endRowIndex': i + 1, 'startColumnIndex': 0, 'endColumnIndex': 4}, 'mergeType': 'MERGE_ALL'}})
    if merge_requests:
        sh.batch_update({'requests': merge_requests})
    print("[DEBUG] Merges complete", file=sys.stderr)

    # --- Summary Dashboard ---
    won_count = len(sections.get('Closed Won', []))
    won_val = sum(float(d.get('amount', 0) or 0) for d in sections.get('Closed Won', []))
    quote_count = len(sections.get('Quote / Invoice Sent', []))
    quote_val = sum(float(d.get('amount', 0) or 0) for d in sections.get('Quote / Invoice Sent', []))
    dmbi_count = len(sections.get('Decision Maker Bought-In', []))
    dmbi_val = sum(float(d.get('amount', 0) or 0) for d in sections.get('Decision Maker Bought-In', []))
    demo_count = len(sections.get('Demo Completed', []))
    demo_val = sum(float(d.get('amount', 0) or 0) for d in sections.get('Demo Completed', []))
    appt_count = len(sections.get('Appointment Scheduled', []))
    appt_val = sum(float(d.get('amount', 0) or 0) for d in sections.get('Appointment Scheduled', []))
    cl_count = len(closed_lost_deals)
    cl_val = sum(float(d.get('amount', 0) or 0) for d in closed_lost_deals)

    total_boards = won_count + quote_count + dmbi_count + demo_count + appt_count
    total_value = won_val + quote_val + dmbi_val + demo_val + appt_val
    open_count = total_boards - won_count
    open_val = total_value - won_val
    nd_calc_val = TOTAL_ONTARIO_VALUE - won_val - open_val - cl_val

    month_day = datetime.strptime(date, '%Y-%m-%d').strftime('%B %-d, %Y')
    dashboard = [
        [f'Pipeline Summary \u2014 {month_day}', '', '', ''],
        ['', '', '', ''],
        ['Metric', 'Count', 'Value (CAD)', 'Notes'],
        ['Total Boards in Pipeline', str(total_boards), total_value, 'All active boards (excl. Closed Lost)'],
        ['Closed Won', str(won_count), won_val, 'Revenue secured'],
        ['Quote / Invoice Sent', str(quote_count), quote_val, 'Awaiting PO/approval'],
        ['Decision Maker Bought-In', str(dmbi_count), dmbi_val, ''],
        ['Demo Completed', str(demo_count), demo_val, 'In demo phase'],
        ['Appointment Scheduled', str(appt_count), appt_val, 'Early stage'],
        ['', '', '', ''],
        ['Total Pipeline Value', str(total_boards), total_value, ''],
        ['Open Pipeline (excl. Won)', str(open_count), open_val, ''],
        ['Closed Lost', str(cl_count), cl_val, ''],
        ["Not Demo'd", str(len(not_demod_boards)), nd_total, f'{len(not_demod_boards)} Ontario boards not yet in pipeline'],
        [f"Non-demo'd Total Value", '', nd_calc_val, f'Total Ontario ({TOTAL_ONTARIO_VALUE:,.0f}) - Won - Open - Lost'],
        [f'Last Synced: {date}', '', '', f'Auto-synced by {source}'],
    ]

    ws_d = sh.worksheet('Summary Dashboard')
    ws_d.update(values=dashboard, range_name='A1:D16', value_input_option='USER_ENTERED')
    ws_d.format('C1:C16', {'numberFormat': {'type': 'CURRENCY', 'pattern': '$#,##0.00'}})
    ws_d.format('A1:D1', {'textFormat': {'bold': True, 'fontSize': 14}})
    ws_d.format('A3:D3', {'textFormat': {'bold': True}, 'backgroundColor': {'red': 0.95, 'green': 0.95, 'blue': 0.95}})

    # --- Change Log ---
    changes = []
    for d in best_deals:
        key = d.get('_board_key', '')
        stage_label = STAGE_MAP.get(d.get('stage', '').lower().strip(), d.get('stage', ''))
        amount = float(d.get('amount', 0) or 0)
        if key in old_deal_map:
            old = old_deal_map[key]
            if old['stage'] and old['stage'] != stage_label:
                changes.append({'board': old['name'], 'type': 'Stage Change', 'old': old['stage'], 'new': stage_label, 'source': 'HubSpot CRM'})
            try:
                ov = float(old['value'].replace('$', '').replace(',', ''))
                if abs(ov - amount) > 1:
                    changes.append({'board': old['name'], 'type': 'Deal Value Updated', 'old': old['value'], 'new': f'${amount:,.2f}', 'source': 'HubSpot CRM'})
            except:
                pass

    if changes:
        ws3 = sh.worksheet('Change Log')
        ws3.append_rows([[date, c['board'], c['type'], c.get('old', ''), c.get('new', ''), c['source'], f'Auto \u2014 {source}'] for c in changes])

    result = {
        'status': 'success',
        'changes_count': len(changes),
        'changes': changes[:10],
        'summary': {
            'total_boards': total_boards, 'total_value': total_value,
            'won': {'count': won_count, 'value': won_val},
            'quote': {'count': quote_count, 'value': quote_val},
            'dmbi': {'count': dmbi_count, 'value': dmbi_val},
            'demo': {'count': demo_count, 'value': demo_val},
            'appt': {'count': appt_count, 'value': appt_val},
            'closed_lost': {'count': cl_count, 'value': cl_val},
            'not_demod': {'count': len(not_demod_boards), 'value': nd_total},
            'non_demod_total_value': nd_calc_val,
        }
    }
    print(json.dumps(result, default=str))


if __name__ == '__main__':
    main()
