using { octo.agent as db } from '../db/setting';

service EnvService {
  entity UserEnv as projection on db.UserEnv;
}