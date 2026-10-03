import './support/typescript-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedTeamRoles, canInviteMember, canManageMemberRole, canRemoveMember, canLeaveOrganization } from '../src/features/organizations/team/policy.ts';
import { newInvitationToken, hashInvitationToken, validInvitationToken, normalizeTeamEmail } from '../src/features/organizations/team/token.ts';
import { safeReturnPath } from '../src/features/auth/return-path.ts';
test('strict permission matrix protects owners and admins across every role pair',()=>{
 const roles=['OWNER','ADMIN','EDITOR','MEMBER'];
 for(const actor of roles)for(const target of roles){const permitted=actor==='OWNER'&&target!=='OWNER'||actor==='ADMIN'&&['EDITOR','MEMBER'].includes(target);assert.equal(canInviteMember(actor,target),permitted);assert.equal(canRemoveMember(actor,target),permitted);for(const next of roles)assert.equal(canManageMemberRole(actor,target,next),permitted&&allowedTeamRoles(actor).includes(next));}
 for(const role of roles)assert.equal(canLeaveOrganization(role),role!=='OWNER');
});
test('random opaque credentials, hash-only storage material and bounded return paths',()=>{
 const credentials=Array.from({length:100},newInvitationToken);assert.equal(new Set(credentials.map(x=>x.token)).size,100);
 for(const {token,tokenHash}of credentials){assert.equal(validInvitationToken(token),true);assert.equal(tokenHash,hashInvitationToken(token));assert.match(tokenHash,/^[a-f0-9]{64}$/);assert.equal(safeReturnPath('/invitations/'+token),'/invitations/'+token);}
 for(const value of ['https://evil.test','//evil.test','/invitations/short','/invitations/'+'a'.repeat(43)+'?next=evil','/invitations/'+'a'.repeat(43)+'/other'])assert.equal(safeReturnPath(value),'/dashboard');
 assert.equal(normalizeTeamEmail(' PERSON@Example.COM '),'person@example.com');
});
