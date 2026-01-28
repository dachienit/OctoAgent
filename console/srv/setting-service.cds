using { octo.agent as db } from '../db/setting';

service EnvService @(impl: './setting-service.cjs', path: '/settings') {
  entity UserEnv as projection on db.UserEnv;
}