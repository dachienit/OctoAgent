using { octo.agent as db } from '../db/setting';

service EnvService @(
  impl: './setting-service.cjs', 
  path: '/settings',
  requires: 'authenticated-user'
) {
  entity UserEnv as projection on db.UserEnv
    where userId = $user.id;
}