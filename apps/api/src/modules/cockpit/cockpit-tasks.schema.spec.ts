import {
  validateCockpitTask,
  validateCockpitTasksOutput,
  CockpitTaskSchema,
} from './cockpit-tasks.schema';

describe('cockpit-tasks.schema', () => {
  const validTask: CockpitTaskSchema = {
    title: 'Unblock PROJ-234: Sarah needs API credentials from DevOps',
    description: 'PROJ-234 has been stuck for 3 days. Sarah is waiting on DevOps for credentials.',
    priority: 'URGENT_TODAY',
    category: 'STALLED_WORK',
    actionItems: [
      {
        label: 'Message Sarah about PROJ-234 status update',
        entityType: 'JIRA_ISSUE',
        entityId: 'PROJ-234',
        entityLabel: 'API credentials setup',
      },
    ],
    linkedEntities: [
      {
        type: 'JIRA_ISSUE',
        id: 'PROJ-234',
        label: 'API credentials setup',
        status: 'In Progress',
      },
      {
        type: 'PERSON',
        id: 'staff-sarah-1',
        label: 'Sarah',
      },
    ],
    evidenceRefs: ['PROJ-234 last updated 3 days ago'],
  };

  describe('validateCockpitTask', () => {
    it('validates a fully populated task', () => {
      const result = validateCockpitTask(validTask);
      expect(result).not.toBeNull();
      expect(result!.title).toBe(validTask.title);
      expect(result!.actionItems).toHaveLength(1);
      expect(result!.linkedEntities).toHaveLength(2);
    });

    it('returns null for missing title', () => {
      expect(validateCockpitTask({ ...validTask, title: '' })).toBeNull();
    });

    it('returns null for missing description', () => {
      expect(validateCockpitTask({ ...validTask, description: '' })).toBeNull();
    });

    it('returns null for invalid priority', () => {
      expect(validateCockpitTask({ ...validTask, priority: 'INVALID' })).toBeNull();
    });

    it('returns null for empty actionItems', () => {
      expect(validateCockpitTask({ ...validTask, actionItems: [] })).toBeNull();
    });

    it('truncates actionItems to max 5', () => {
      const sixItems = Array.from({ length: 6 }, (_, i) => ({
        label: `Action ${i}`,
      }));
      const result = validateCockpitTask({ ...validTask, actionItems: sixItems });
      expect(result).not.toBeNull();
      expect(result!.actionItems).toHaveLength(5);
    });

    it('accepts tasks without linkedEntities', () => {
      const result = validateCockpitTask({ ...validTask, linkedEntities: [] });
      expect(result).not.toBeNull();
      expect(result!.linkedEntities).toHaveLength(0);
    });

    it('filters out invalid action items', () => {
      const result = validateCockpitTask({
        ...validTask,
        actionItems: [
          { label: 'Valid action' },
          { label: '' }, // invalid - empty label
          { label: 'Another valid', entityType: 'JIRA_ISSUE' },
        ],
      });
      expect(result).not.toBeNull();
      expect(result!.actionItems).toHaveLength(2);
    });

    it('filters out invalid linked entities', () => {
      const result = validateCockpitTask({
        ...validTask,
        linkedEntities: [
          { type: 'PERSON', id: 'staff-1', label: 'Sarah' },
          { type: 'INVALID_TYPE', id: 'x', label: 'Bad' }, // invalid type
          { type: 'JIRA_ISSUE', id: '', label: 'No ID' }, // empty id
        ],
      });
      expect(result).not.toBeNull();
      expect(result!.linkedEntities).toHaveLength(1);
    });

    it('returns null for null/undefined input', () => {
      expect(validateCockpitTask(null)).toBeNull();
      expect(validateCockpitTask(undefined)).toBeNull();
      expect(validateCockpitTask('string')).toBeNull();
    });

    it('accepts all valid priority values', () => {
      for (const p of ['URGENT_TODAY', 'NEEDS_APPROVAL', 'OPPORTUNITY', 'HYGIENE']) {
        const result = validateCockpitTask({ ...validTask, priority: p });
        expect(result).not.toBeNull();
        expect(result!.priority).toBe(p);
      }
    });

    it('parses evidenceRefs correctly', () => {
      const result = validateCockpitTask({
        ...validTask,
        evidenceRefs: ['ref-1', 'ref-2', 42], // 42 is not a string, should be filtered
      });
      expect(result).not.toBeNull();
      expect(result!.evidenceRefs).toEqual(['ref-1', 'ref-2']);
    });

    it('omits evidenceRefs when empty after filtering', () => {
      const result = validateCockpitTask({
        ...validTask,
        evidenceRefs: [42, null, ''],
      });
      expect(result).not.toBeNull();
      expect(result!.evidenceRefs).toBeUndefined();
    });
  });

  describe('validateCockpitTasksOutput', () => {
    it('validates a complete output', () => {
      const output = {
        tasks: [validTask],
        generatedAt: '2026-03-17T10:00:00Z',
      };
      const result = validateCockpitTasksOutput(output);
      expect(result).not.toBeNull();
      expect(result!.tasks).toHaveLength(1);
      expect(result!.generatedAt).toBe('2026-03-17T10:00:00Z');
    });

    it('returns null for empty tasks array', () => {
      expect(validateCockpitTasksOutput({ tasks: [] })).toBeNull();
    });

    it('returns null for missing tasks field', () => {
      expect(validateCockpitTasksOutput({ generatedAt: 'now' })).toBeNull();
    });

    it('filters out invalid tasks and keeps valid ones', () => {
      const output = {
        tasks: [
          validTask,
          { title: '', description: 'bad task' }, // invalid
        ],
      };
      const result = validateCockpitTasksOutput(output);
      expect(result).not.toBeNull();
      expect(result!.tasks).toHaveLength(1);
    });

    it('generates generatedAt when missing', () => {
      const output = { tasks: [validTask] };
      const result = validateCockpitTasksOutput(output);
      expect(result).not.toBeNull();
      expect(result!.generatedAt).toBeDefined();
    });

    it('returns null for non-object input', () => {
      expect(validateCockpitTasksOutput(null)).toBeNull();
      expect(validateCockpitTasksOutput('string')).toBeNull();
      expect(validateCockpitTasksOutput(42)).toBeNull();
    });
  });
});
