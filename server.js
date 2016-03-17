'use strict';

const MAX_MESSAGES = 10;

const http = require('http');
const httpServer = http.createServer(function(req, res) {
  res.writeHead(404);
  res.end();
});

httpServer.listen(8081, function() {
  console.log('Server is listening on port 8081');
});

const jwt = require('jsonwebtoken');
const WebSocketServer = require('websocket').server;
const wsServer = new WebSocketServer({ httpServer });

const conversations = new Map();

wsServer.on('request', (req) => {
  const connection = req.accept(null, req.origin);

  let conversation;
  let conversationId;
  let displayName;
  let expectedReqId = 0;
  let isAdmin = false;

  connection.on('message', (message) => {
    let data;

    expectedReqId += 1;

    try {
      data = JSON.parse(message.utf8Data);
    } catch(e) {
      connection.send(JSON.stringify({
        type: 'response',
        reqId: data.reqId,
        statusCode: 400,
        body: 'Invalid request format. Expecting JSON string.'
      }));

      return console.info('Received malformed message');
    }

    if (data.reqId !== expectedReqId) {
      connection.send(JSON.stringify({
        type: 'response',
        reqId: data.reqId,
        statusCode: 400,
        body: 'Invalid reqId. Expected: ' + expectedReqId
      }));
    }

    setTimeout(() => {
      switch(data.command) {
        /**
         * Initialize a client's session by adding them to
         * their specified conversation ID by their display name
         */
        case 'join-conversation':
          // Remove client from any previous conversations.
          removeClientFromConversation(displayName, conversation);

          displayName = data.args.displayName;
          conversationId = data.args.conversationId;

          // Create the conversation if one doesn't exist for the specified ID.
          conversation = conversations.get(conversationId);
          if (!conversation) {
            conversation = { messages: [], members: new Map() };
            conversations.set(conversationId, conversation);
          // Respond with an error if the displayName is already taken in this conversation.
          } else if (conversation.members.has(displayName)) {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 400,
              body: 'Display name already taken'
            }));
          }

          // Respond to the client with a 200.
          connection.send(JSON.stringify({
            type: 'response',
            reqId: data.reqId,
            statusCode: 200
          }));

          conversation.members.forEach((member, memberName) => {
            // Send a member-joined event to each other member in the conversation.
            member.connection.send(JSON.stringify({
              type: 'event',
              name: 'member-joined',
              data: displayName
            }));

            // Send a member-joined event to the client for each other member.
            connection.send(JSON.stringify({
              type: 'event',
              name: 'member-joined',
              data: displayName
            }));
          });

          // Add this client to the members list.
          conversation.members.set(displayName, { connection });
          break;

        /**
         * Send a message from the client to the conversation
         */
        case 'send-message':
          if (!data.args) {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 400,
              body: 'send-message requires a "text" argument in args'
            }));
          }

          const msg = encodeURIComponent(displayName + ': ' + data.args.text);

          if (!conversation) {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 400,
              body: 'Tried to send message before joining a conversation'
            }));
          }

          conversation.messages.push(msg);
          if (conversation.messages.length > MAX_MESSAGES) {
            conversation.messages.shift();
          }

          connection.send(JSON.stringify({
            type: 'response',
            reqId: data.reqId,
            statusCode: 200
          }));

          conversation.members.forEach((member) => {
            member.connection.send(JSON.stringify({
              type: 'event',
              name: 'new-message',
              data: msg
            }));
          });

          break;

        /**
         * Get a list of stored messages of the conversation.
         * Limited to 10.
         */
        case 'get-messages':
          if (!conversation) {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 400,
              body: 'Tried to get messages before joining a conversation'
            }));
          }

          connection.send(JSON.stringify({
            type: 'response',
            reqId: data.reqId,
            statusCode: 200,
            body: conversation.messages.join(',')
          }));

          break;

        /**
         * Authenticate as an admin using a signed JWT token.
         */
        case 'authenticate':
          if (!data.args || typeof data.args.token !== 'string') {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 400,
              body: 'Expected "token" argument to contain a JWT String.'
            }));
          }

          let payload;
          try {
            payload = jwt.verify(data.args.token, 'dr4w-th3-0wl');
          } catch (e) {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 401,
              body: e.toString()
            }));
          }

          isAdmin = !!payload.admin;

          connection.send(JSON.stringify({
            type: 'response',
            reqId: data.reqId,
            statusCode: 200
          }));

          break;

        /**
         * Admin-level command to kick a member from a conversation.
         */
        case 'remove-member':
          if (!isAdmin) {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 401,
              body: 'remove-member command requires admin permissions'
            }));
          }

          let member = conversation.members.get(data.args.name);
          if (member) {
            removeClientFromConversation(data.args.name, conversation);
          } else {
            return connection.send(JSON.stringify({
              type: 'response',
              reqId: data.reqId,
              statusCode: 400,
              body: 'Member not found: ' + data.args.name
            }));
          }

          connection.send(JSON.stringify({
            type: 'response',
            reqId: data.reqId,
            statusCode: 200
          }));

          break;

        /**
         * An invalid command was sent.
         */
        default:
          connection.send(JSON.stringify({
            type: 'response',
            reqId: data.reqId,
            statusCode: 400,
            body: 'Unknown command: ' + data.command
          }));

          break;
      }
    }, Math.random()*400);
  });

  connection.on('close', () => removeClientFromConversation(displayName, conversation));
});

function removeClientFromConversation(displayName, conversation) {
  if (!conversation || !conversation.members.has(displayName)) { return; }

  // Remove the client from the conversation.
  conversation.members.delete(displayName);

  // Send member-left events to other members in the conversation.
  conversation.members.forEach((member, memberName) => {
    member.connection.send(JSON.stringify({
      type: 'event',
      name: 'member-left',
      data: displayName
    }));
  });
}

