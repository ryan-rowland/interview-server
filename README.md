#Quick Chat Server

### Description
QuickChat is a simple WebSocket implementation that relays messages between connected clients, storing up to the 10 most recent messages for each conversation.

### API

#### Sending a Command
The WebSocket server expects to receive a UTF8-encoded stringified JSON payload, specifying the <String>command, <Number>reqId and <Object>args parameters. The reqId (request ID) field is set by the client and is used to identify which request a subsequent response is for. The server expects the first request to be `reqId=1` and every subsequent request to be `reqId+=1`, regardless of success or failure.

For example:
```
{
  command: 'join-conversation',
  reqId: 1,
  args: {
    displayName: 'Alice',
    conversationId: 'myConversation'
  }
}
```

The server will then send a Response as a UTF8-encoded stringified JSON payload of type `response`, containing a reqId to track which request it is responding to, a statusCode of `[200, 400, 401]` reflecting the result of the request using HTTP status codes and a body containing any relevant human-readable error message if applicable.

For example:
```
{
  type: 'response',
  reqId: 1,
  statusCode: 200,
  body: null
}
```

##### Accepted Commands

Command | Arguments | Description
--------|-----------|------------
authenticate | String jwt | A signed JWT token string containing permission flags.
get-messages | N/A | Request a list of URI-encoded messages the server knows about (The server stores up to the 10 most recent).
join-conversation | String displayName, String conversationId | Joins the client to the specified conversation, as the specified alias.
remove-member | String name | Removed a specific member from the active conversation. Requires admin permissions.
send-message | String text | Sends a message to the client's active conversation.
 
#### Receiving an Event
The WebSocket server sends periodic updates, using events. An event is a UTF-8 encoded stringified JSON payload of type `event`, containing the <String>name and <String>data properties.

For example:
```
{
  type: 'event',
  name: 'new-message',
  data: 'Bob: Hello Alice!'
}
```

##### Events

Type | Body Contains | Description
-----|---------------|------------
member-joined | String name | A new client has connected to the active conversation. This will also be sent to a client once for every existing member in the conversation it is joining.
member-left | String name | A member has left the conversation.
message-list | String messageList | A response to the client's request for a list of known messages. The list is a single string containing a comma-separated list of URI encoded messages.
new-message | String message | A new message has been added to the active conversation. Message is URI encoded.

##### Authentication

To authenticate, the server takes a signed JWT token (SHA 256). The secret used to sign the JWT token will be given to you by your interviewer. The payload of the token should contain the permissions granted to the user. In this case, our only permission is `admin`. Hence, the payload to authenticate a non-admin would look like so:

```
{
  admin: false
}
```
