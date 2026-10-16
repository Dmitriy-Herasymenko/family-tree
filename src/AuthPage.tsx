import { useState, type FormEvent } from 'react';
import { Sprout, ArrowRight, Eye, EyeOff, ShieldCheck, Network, Heart, RefreshCw } from 'lucide-react';
import { api, accountTrees } from './api';
import { navigate, type AuthRoute } from './routes';
import type { Profile, Tree } from './data';

type Props = { route: AuthRoute; available: boolean; onAuthenticated: (profile: Profile, trees: Tree[]) => void };
export default function AuthPage({ route, available, onAuthenticated }: Props) {
  const register = route === '/register';
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || pending) return;
    const data = new FormData(event.currentTarget);
    setError(''); setPending(true);
    try {
      const result = await api<{ profile: Profile }>(register ? '/auth/register' : '/auth/login', 'POST', {
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        password: String(data.get('password') || ''),
        familyName: String(data.get('familyName') || '').trim(),
      });
      const { trees } = await accountTrees();
      if (!trees.length) throw new Error('Не вдалося завантажити дерева. Оновіть сторінку та спробуйте увійти.');
      onAuthenticated(result.profile, trees);
    } catch (error) { setError(error instanceof Error ? error.message : 'Не вдалося увійти. Спробуйте ще раз.'); }
    finally { setPending(false); }
  }
  function follow(event: React.MouseEvent<HTMLAnchorElement>, path: AuthRoute) {
    if(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    event.preventDefault();navigate(path);
  }
  return <div className="auth-page">
    <aside className="auth-story" aria-label="Рідні — історія вашої родини">
      <a className="brand auth-brand" href="/login" onClick={event=>follow(event,'/login')}><span className="brand-icon"><Sprout size={31} strokeWidth={1.6}/></span><span>рідні<span className="brand-period">.</span></span></a>
      <div className="auth-story-content"><span className="eyebrow">ТЕ, ЩО НАС ПОЄДНУЄ</span><h1>У кожної родини <br/>є історія. <br/><em>Збережіть свою.</em></h1><p>Поєднайте покоління, зберіть спогади<br className="auth-desktop-break"/> та відкрийте своє коріння.</p>
        <div className="auth-tree-art" aria-hidden="true"><svg viewBox="0 0 380 235" fill="none"><path d="M190 220V160M190 160C190 112 70 160 70 101V70M190 160C190 112 310 160 310 101V70M190 160V50" stroke="#a5b18c" strokeWidth="1.4"/><path d="M190 192C169 192 160 181 160 165C181 165 190 176 190 192ZM190 172C190 152 200 143 218 143C218 163 208 172 190 172Z" fill="#d7dfc6" stroke="#a5b18c"/><circle cx="70" cy="53" r="25" fill="#fafbf6" stroke="#d2dbc3"/><circle cx="190" cy="40" r="28" fill="#fafbf6" stroke="#d2dbc3"/><circle cx="310" cy="53" r="25" fill="#fafbf6" stroke="#d2dbc3"/><path d="M60 58C60 49 80 49 80 58M181 46C181 37 199 37 199 46M300 58C300 49 320 49 320 58" stroke="#9eaf87" strokeWidth="1.5" strokeLinecap="round"/><circle cx="70" cy="45" r="5" stroke="#9eaf87" strokeWidth="1.5"/><circle cx="190" cy="31" r="5" stroke="#9eaf87" strokeWidth="1.5"/><circle cx="310" cy="45" r="5" stroke="#9eaf87" strokeWidth="1.5"/><circle cx="190" cy="211" r="16" fill="#54724d"/><path d="M185 211L189 215L196 207" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="art-label art-left">Ваше коріння</span><span className="art-label art-right">Ваші близькі</span><span className="art-label art-bottom">Ваша історія</span></div>
      </div>
      <div className="auth-story-footer"><Heart size={14}/><span>Найцінніше — пам’ятати, звідки ми.</span></div>
    </aside>
    <main className="auth-main">
      <div className="auth-switch-prompt">{register?'Уже маєте акаунт?':'Ще немає акаунта?'} <a href={register?'/login':'/register'} onClick={event=>follow(event,register?'/login':'/register')}>{register?'Увійти':'Зареєструватися'}<ArrowRight size={14}/></a></div>
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <span className="auth-welcome-icon">{register?<Sprout size={25}/>:<Network size={25}/>}</span><span className="eyebrow">ВАША РОДИННА ІСТОРІЯ</span>
        <h2 id="auth-title">{register?'Створіть простір для рідних':'Раді бачити вас знову'}</h2>
        <p className="auth-page-subtitle">{register?'Почніть власне родинне дерево. Збережіть історії, які мають значення.':'Увійдіть, щоб продовжити історію вашої родини.'}</p>
        {!available&&<div className="auth-connection-error" role="alert"><strong>Сервер тимчасово недоступний</strong><p>Перевірте запуск API та підключення до бази. Ваші дерева залишаються в акаунті.</p><button type="button" onClick={()=>location.reload()}><RefreshCw size={14}/>Спробувати знову</button></div>}
        <form onSubmit={submit} aria-busy={pending}>
          <fieldset disabled={pending||!available} className="auth-fieldset">
            {register&&<label className="form-field" htmlFor="auth-name">Ім’я та прізвище<input id="auth-name" name="name" placeholder="Як вас звати?" autoComplete="name" required maxLength={80}/></label>}
            <label className="form-field" htmlFor="auth-email">Електронна пошта<input id="auth-email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={254}/></label>
            {register&&<label className="form-field" htmlFor="auth-family">Назва вашої родини<input id="auth-family" name="familyName" placeholder="Наприклад, родина Шевченків" required maxLength={80}/></label>}
            <label className="form-field" htmlFor="auth-password">Пароль<span className="auth-password-field"><input id="auth-password" name="password" type={showPassword?'text':'password'} placeholder={register?'Щонайменше 8 символів':'Ваш пароль'} autoComplete={register?'new-password':'current-password'} required minLength={8} maxLength={128}/><button type="button" aria-label={showPassword?'Приховати пароль':'Показати пароль'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
            {error&&<p className="form-error" role="alert">{error}</p>}
            <button className="btn primary full-width auth-submit" type="submit">{pending?'Зачекайте…':register?'Створити акаунт і родину':'Увійти'}{!pending&&<ArrowRight size={17}/>}</button>
          </fieldset>
        </form>
        <p className="auth-privacy"><ShieldCheck size={15}/>{register?'Ваша родина — ваш приватний простір.':'Дерева доступні тільки у вашому акаунті.'}</p>
        <div className="auth-bottom-link">{register?'Уже зберігаєте історію з нами?':'Почніть свою родинну історію.'} <a href={register?'/login':'/register'} onClick={event=>follow(event,register?'/login':'/register')}>{register?'Увійти':'Створити акаунт'}</a></div>
      </section>
      <footer className="auth-page-footer"><span>© {new Date().getFullYear()} Рідні</span><span>Усе починається з родини.</span></footer>
    </main>
  </div>;
}
