import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AuthPage from '../src/AuthPage';
import { redirectPath, authRoute } from '../src/routes';

test('guests are redirected to login and can open registration directly',()=>{
  assert.equal(redirectPath('/',false),'/login');
  assert.equal(redirectPath('/anything',false),'/login');
  assert.equal(redirectPath('/login',false),null);
  assert.equal(redirectPath('/register',false),null);
  assert.equal(authRoute('/register'),'/register');
});
test('authenticated users go to their workspace from either auth page',()=>{
  assert.equal(redirectPath('/login',true),'/');
  assert.equal(redirectPath('/register',true),'/');
  assert.equal(redirectPath('/',true),null);
});
test('login is a standalone form with a link to registration',()=>{
  const html=renderToStaticMarkup(createElement(AuthPage,{route:'/login',available:true,onAuthenticated:()=>{}}));
  assert.match(html,/name="email"/);assert.match(html,/name="password"/);
  assert.match(html,/href="\/register"/);
  assert.doesNotMatch(html,/name="familyName"/);
  assert.doesNotMatch(html,/Коваленко|app-shell|modal-backdrop/);
});
test('registration asks for a personal account and a named family',()=>{
  const html=renderToStaticMarkup(createElement(AuthPage,{route:'/register',available:true,onAuthenticated:()=>{}}));
  for(const name of ['name','email','password','familyName'])assert.ok(html.includes(`name="${name}"`));
  assert.match(html,/href="\/login"/);assert.match(html,/new-password/);
  assert.doesNotMatch(html,/Коваленко|modal-backdrop/);
});
test('unavailable backend disables authentication and offers retry',()=>{
  const html=renderToStaticMarkup(createElement(AuthPage,{route:'/login',available:false,onAuthenticated:()=>{}}));
  assert.match(html,/<fieldset[^>]*disabled/);
  assert.match(html,/Сервер тимчасово недоступний/);
  assert.match(html,/Спробувати знову/);
});
