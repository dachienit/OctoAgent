namespace octo.agent;

entity UserEnv {
  key userId    : String(20);
  brainId       : String(50);
  theme         : String(20);
  secret        : String(50);
  customPrompt  : LargeString;
  createdAt     : Timestamp;
  updatedAt     : Timestamp;
}