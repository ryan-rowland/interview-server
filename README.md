#Quick Chat Server

### Description
QuickChat is a simple WebSocket implementation that relays messages between connected clients, storing up to the 10 most recent messages for each conversation.

### API

#### Sending a Command
The WebSocket server expects to receive a UTF8-encoded stringified JSON payload, specifying a <String>command and an <Object>args.

For example:
```
{
  command: 'join-conversation',
  args: {
    displayName: 'Alice',
    conversationId: 'myConversation'
  }
}
```

##### Accepted Commands

Command | Arguments | Description
---------------------------------
join-conversation | String displayName, String conversationId | Joins the client to the specified conversation, as the specified alias.
send-message | String text | Sends a message to the client's active conversation.
get-messages | N/A | Request a list of messages the server knows about (The server stores up to the 10 most recent).
 
#### Receiving an Event
The WebSocket server responds to requests, and sends periodic updates, using events. An event is a UTF-8 encoded stringified JSON payload, containing a <String>type and a <String>body.

For example:
```
{
  type: 'new-message',
  body: 'Bob: Hello Alice!'
}
```

##### Events

Type | Body Contains | Description
conversation-joined | N/A | The client has successfully joined a conversation.
new-message | String message | A new message has been added to the active conversation.
message-list | String messageList | A response to the client's request for a list of known messages. The list is a single string containing a comma-separated list of URI encoded messages.
error | String description | The client sent a bad request to the server.
