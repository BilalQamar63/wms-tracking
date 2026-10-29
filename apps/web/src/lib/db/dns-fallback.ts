import dns from 'node:dns';

let fallbackApplied = false;

export async function connectWithDnsFallback<T>(
  uri: string,
  connect: () => Promise<T>,
): Promise<T> {
  try {
    return await connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !uri.startsWith('mongodb+srv://') ||
      fallbackApplied ||
      !/querySrv|ENOTFOUND|EAI_AGAIN/i.test(message)
    ) {
      throw error;
    }

    fallbackApplied = true;
    console.warn('[db] Atlas DNS lookup failed; retrying with public DNS resolvers.');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    return connect();
  }
}
