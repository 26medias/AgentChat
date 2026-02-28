export default function MessageItem({ message }) {
  const isSystem = message.metadata?.system;

  if (isSystem) {
    const isError = message.metadata?.error;
    return (
      <div className={`px-2 py-1 text-sm whitespace-pre-wrap ${isError ? 'text-red-400' : 'text-gray-400'}`}>
        {message.message}
      </div>
    );
  }

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const sender = message.from || message.sender;

  return (
    <div className="flex items-start gap-3 py-1 hover:bg-gray-800/50 px-2 rounded group">
      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {sender?.[0]?.toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">{sender}</span>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <p className="text-sm text-gray-300 break-words whitespace-pre-wrap">{message.message}</p>
      </div>
    </div>
  );
}
