service ChatService @(impl: './chat-service.cjs', path: '/api') {

  type EnvSettings {
    brainId : String;
    ntid : String;
    customPrompt : String;
    theme : String;
    skill : String;
  }

  type ChatResponse {
    reply : LargeString;
    hisID : String;
  }

  type UserDetails {
    username : String;
    email : String;
    firstName : String;
    lastName : String;
  }

  type SkillContent {
      content: LargeString;
  }

  action chat (
    message : LargeString,
    env : EnvSettings,
    option : String,
    reLoad : Boolean,
    objectType : String,
    objectName : String,
    error : LargeString,
    historyID : String
  ) returns ChatResponse;

  function userinfo() returns UserDetails;

  function skills() returns array of String;
  
  function getSkill(filename: String) returns SkillContent;
  
  action saveSkill(filename: String, content: LargeString) returns Boolean;
  


}
