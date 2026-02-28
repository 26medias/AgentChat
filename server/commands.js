const fs = require('fs');
const path = require('path');

// command name -> { description, handler }
const registry = new Map();

function register(name, description, handler) {
  registry.set(name, { description, handler });
}

async function execute(name, args, context) {
  const cmd = registry.get(name);
  if (!cmd) return null;
  return cmd.handler(args, context);
}

function list() {
  const result = [];
  for (const [name, { description }] of registry) {
    result.push({ name, description });
  }
  return result;
}

// Auto-discover command plugins from ./commands/ directory
const commandsDir = path.join(__dirname, 'commands');
if (fs.existsSync(commandsDir)) {
  for (const file of fs.readdirSync(commandsDir)) {
    if (!file.endsWith('.js')) continue;
    const plugin = require(path.join(commandsDir, file));
    if (plugin.name && plugin.description && plugin.handler) {
      register(plugin.name, plugin.description, plugin.handler);
    }
  }
}

module.exports.register = register;
module.exports.execute = execute;
module.exports.list = list;
