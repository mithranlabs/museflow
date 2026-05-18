export const logExecution = (agent: string, status: string, details?: any) => {
  console.log(`[${new Date().toISOString()}] [${agent}] [${status}]`, details ? JSON.stringify(details) : '');
};
