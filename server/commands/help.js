const commands = require('../commands');

module.exports = {
    name: 'help',
    description: 'List available commands',
    handler() {
        return commands.list().map(c => `/${c.name} - ${c.description}`).join('\n');
    },
};
