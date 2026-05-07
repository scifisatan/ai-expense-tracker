export interface AuthIdentityRepo {
  findChatIdByUsername(username: string): Promise<number | null>;
}
