const { v4: uuidv4 } = require('uuid');

module.exports = {
    name: 'system',
    description: 'Broadcast a system message to the room',
    handler(args, context) {
        if (!args || !args.trim()) return 'Usage: /system <message>';

        context.broadcast(context.room, {
            type: 'message:new',
            id: uuidv4(),
            from: 'system',
            room: context.room,
            timestamp: Date.now(),
            message: args.trim(),
            metadata: { system: true },
        });

        return `System message sent to #${context.room}`;
    },
};
