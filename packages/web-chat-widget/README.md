# BookingOS Chat Widget

Embeddable chat widget for BookingOS. Connects to the web-chat WebSocket namespace for real-time customer messaging.

## Embed Snippet

```html
<!-- BookingOS Chat Widget -->
<script src="https://api.businesscommandcentre.com/chat-widget/booking-os-chat.js"></script>
<script>
  BookingOSChat.init({
    businessId: 'YOUR_BUSINESS_ID',
    apiUrl: 'https://api.businesscommandcentre.com',
  });
</script>
```

## Configuration Options

| Option           | Type                             | Default                                | Description                        |
| ---------------- | -------------------------------- | -------------------------------------- | ---------------------------------- |
| `businessId`     | `string`                         | **required**                           | Business ID                        |
| `apiUrl`         | `string`                         | **required**                           | API base URL                       |
| `position`       | `'bottom-right' \| 'bottom-left'` | `'bottom-right'`                     | Widget position                    |
| `primaryColor`   | `string`                         | `'#71907C'`                            | Primary color (sage green)         |
| `title`          | `string`                         | `'Chat with us'`                       | Header title                       |
| `subtitle`       | `string`                         | `'We typically reply within minutes'`  | Header subtitle                    |
| `placeholder`    | `string`                         | `'Type a message...'`                  | Input placeholder                  |
| `offlineMessage` | `string`                         | `"We're currently offline..."`         | Offline form message               |
| `preChatFields`  | `Array<'name'\|'email'\|'phone'>` | `['name', 'email']`                   | Fields to show in pre-chat form    |
| `zIndex`         | `number`                         | `999999`                               | CSS z-index for the widget         |

## Building

```bash
# Production build (minified)
npm run build

# Development watch mode
npm run dev
```

## Architecture

- **Shadow DOM** isolation prevents CSS conflicts with the host page
- **Socket.IO** for real-time messaging via the `/web-chat` namespace
- **Session persistence** via localStorage (reconnects to existing sessions)
- **No framework dependencies** -- pure TypeScript DOM manipulation
- **IIFE bundle** for global `BookingOSChat.init()` usage
