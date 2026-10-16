import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import type { Person } from './data';
import { Avatar } from './FamilyCanvas';
import { preparePhoto } from './photo';

export default function PhotoPicker({person,onChange,onProcessing}: {person:Person;onChange:(photo:string)=>void;onProcessing:(busy:boolean)=>void}) {
  const input=useRef<HTMLInputElement>(null);
  const sequence=useRef(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>()=>{sequence.current++;},[]);
  async function choose(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    const current=++sequence.current;setError('');setBusy(true);onProcessing(true);
    try{const photo=await preparePhoto(file);if(sequence.current===current)onChange(photo);}
    catch(error){if(sequence.current===current)setError(error instanceof Error?error.message:'Не вдалося завантажити фото.');}
    finally{if(sequence.current===current){setBusy(false);onProcessing(false);}}
  }
  return <div className="photo-picker">
    <div className="photo-picker-row"><div className="photo-preview"><Avatar key={person.photo} person={person} size="detail"/><span><Camera size={13}/></span></div><div className="photo-picker-actions"><strong>Фото людини</strong><p>JPG, PNG або WebP, до 10 МБ.<br/>Фото буде обрізано до квадрата.</p><div><button type="button" className="btn secondary" disabled={busy} onClick={()=>input.current?.click()}><ImagePlus size={15}/>{busy?'Готуємо фото…':person.photo?'Замінити фото':'Додати фото'}</button>{person.photo&&<button type="button" className="photo-remove" disabled={busy} onClick={()=>{onChange('');setError('');}}><Trash2 size={14}/>Прибрати</button>}</div></div></div>
    <input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Вибрати фото людини" onChange={choose} disabled={busy}/>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <p className="photo-save-hint">{busy?'Підготовка фото…':'Фото збережеться разом із карткою людини.'}</p>
  </div>;
}
