import { useState } from 'react';
import { Plus, X, UsersRound } from 'lucide-react';
import { type Person, fullName, years } from './data';
import { availableChildren } from './domain';

export default function ChildPicker({ people, parent, value, onChange }: {people: Person[]; parent: Person; value: string[]; onChange: (ids: string[]) => void}) {
  const [selected, setSelected] = useState('');
  const candidates = availableChildren(people, parent, value);
  return <div className="child-picker">
    {value.length>0&&<div className="linked-children">{value.map(id=>{
      const child=people.find(p=>p.id===id);if(!child)return null;
      return <div className="linked-child" key={id}><span className="linked-child-icon"><UsersRound size={17}/></span><span><strong>{fullName(child)}</strong><small>{years(child)}</small></span><button type="button" aria-label={`Відв’язати дитину: ${fullName(child)}`} onClick={()=>onChange(value.filter(value=>value!==id))}><X size={15}/></button></div>;
    })}</div>}
    {candidates.length>0?<><label className="form-field">Вибрати людину з родини<span className="child-select-row"><select value={candidates.some(p=>p.id===selected)?selected:''} onChange={event=>setSelected(event.target.value)}><option value="">Оберіть уже додану людину</option>{candidates.map(child=><option key={child.id} value={child.id}>{fullName(child)}{child.birth?` · ${child.birth.slice(0,4)}`:''}</option>)}</select><button className="btn secondary" type="button" disabled={!candidates.some(p=>p.id===selected)} onClick={()=>{onChange([...value,selected]);setSelected('');}}><Plus size={16}/>Додати</button></span></label><p className="child-picker-hint">Це додасть лише родинний зв’язок. Повторно вводити ім’я не потрібно.</p></>:<p className="child-picker-empty">Немає інших людей, яких можна прив’язати як дитину. Якщо в людини вже двоє батьків, змініть цей зв’язок у її картці.</p>}
    {value.length>0&&<p className="child-picker-hint">Відв’язування прибирає лише зв’язок із цією людиною. Дитина залишається в дереві.</p>}
  </div>;
}
