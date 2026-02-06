namespace octo.agent;

entity UserEnv {
  key userId    : String(50);
  brainId       : String(100);
  theme         : String(20) default 'colorful';
  secret        : String(100);
  customPrompt  : LargeString;
  createdAt     : Timestamp @cds.on.insert: $now;
  updatedAt     : Timestamp @cds.on.insert: $now  @cds.on.update: $now;
}