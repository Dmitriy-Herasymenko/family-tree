import type { Person } from './data';

export default function PersonFields({ person, onChange }: { person: Person; onChange: (person: Person) => void }) {
  return <>
    <div className="form-row">
      <label className="form-field">Ім’я<input name="firstName" value={person.firstName} onChange={e=>onChange({...person,firstName:e.target.value})} required maxLength={60} placeholder="Тарас"/></label>
      <label className="form-field">Прізвище<input name="lastName" value={person.lastName} onChange={e=>onChange({...person,lastName:e.target.value})} required maxLength={60} placeholder="Шевченко"/></label>
    </div>
    <div className="form-row">
      <label className="form-field">По батькові<input name="patronymic" value={person.patronymic??''} onChange={e=>onChange({...person,patronymic:e.target.value})} maxLength={60} placeholder="За наявності"/></label>
      <label className="form-field">Стать<select name="gender" value={person.gender} onChange={e=>onChange({...person,gender:e.target.value as Person['gender']})}><option value="male">Чоловіча</option><option value="female">Жіноча</option><option value="other">Не вказано</option></select></label>
    </div>
    {person.gender==='female'&&<label className="form-field">Дівоче прізвище<input name="maidenName" value={person.maidenName??''} onChange={e=>onChange({...person,maidenName:e.target.value})} maxLength={60} placeholder="Прізвище до шлюбу, якщо відоме"/></label>}
    <div className="form-row">
      <label className="form-field">Дата народження<input name="birth" type="date" value={person.birth} onChange={e=>onChange({...person,birth:e.target.value})}/></label>
      <label className="form-field">Дата смерті <span className="optional">необов’язково</span><input name="death" type="date" value={person.death} onChange={e=>onChange({...person,death:e.target.value})}/></label>
    </div>
    <div className="form-row">
      <label className="form-field">Місце народження<input name="place" value={person.place} maxLength={120} onChange={e=>onChange({...person,place:e.target.value})} placeholder="Місто / село, країна"/></label>
      <label className="form-field">Область<input name="region" value={person.region??''} maxLength={120} onChange={e=>onChange({...person,region:e.target.value})} placeholder="Наприклад, Полтавська"/></label>
    </div>
  </>;
}
