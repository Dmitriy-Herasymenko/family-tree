import { memo, useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Handle, Position, useReactFlow, ReactFlowProvider, type NodeProps, type Node, type Edge } from '@xyflow/react';
import { Plus, Minus, Maximize, LocateFixed, MapPin, UserRound, Sprout } from 'lucide-react';
import { type Person, type Tree, generationMap, years, matchesPerson, fullName, displaySurname } from './data';

type PersonNode = Node<{ person: Person; root: boolean; dim: boolean; onSelect: (p: Person) => void }, 'person'>;
export function Avatar({ person, size = '' }: { person: Person; size?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(()=>setFailed(false),[person.photo]);
  return <span className={`avatar ${person.gender} ${size}`}>{person.photo && !failed ? <img src={person.photo} alt="" onError={() => setFailed(true)} /> : <span>{person.firstName.charAt(0)}{person.lastName.charAt(0)}</span>}</span>;
}
const PersonCard = memo(function PersonCard({ data }: NodeProps<PersonNode>) {
  const p = data.person;
  return <button className={`person-node ${data.root ? 'is-root' : ''} ${data.dim ? 'dimmed' : ''}`} onClick={() => data.onSelect(p)} aria-label={`Відкрити: ${fullName(p)}`}>
    <Handle type="target" position={Position.Top} id="parent" />
    <Handle type="source" position={Position.Bottom} id="child" />
    <Handle type="source" position={Position.Right} id="partner-right" />
    <Handle type="target" position={Position.Left} id="partner-left" />
    <span className="node-avatar"><Avatar person={p} size="large" />{data.root && <span className="root-mark"><Sprout size={12}/></span>}</span>
    <strong>{p.firstName}<span>{displaySurname(p)}</span>{p.patronymic&&<span className="node-patronymic">{p.patronymic}</span>}</strong>
    <small>{years(p)}</small>
    <span className="node-place"><MapPin size={11}/>{p.place.split(',')[0] || p.region || 'Місце не вказано'}</span>
    {data.root && <span className="you-badge">Корінь дерева</span>}
  </button>;
});
const nodeTypes = { person: PersonCard };
function Canvas({ tree, query, onSelect, onAdd }: { tree: Tree; query: string; onSelect: (p: Person) => void; onAdd: () => void }) {
  const flow = useReactFlow();
  const [zoom, setZoom] = useState(1);
  const { nodes, edges } = useMemo(() => {
    const levels = generationMap(tree.people);
    const groups = new Map<number, Person[]>();
    tree.people.forEach(p => { const l = levels.get(p.id) || 0; groups.set(l, [...(groups.get(l) || []), p]); });
    const nodes: PersonNode[] = [];
    const edges: Edge[] = [];
    const order = new Map<string, number>();
    groups.forEach((people, level) => {
      const sorted: Person[] = [];
      people.forEach(p => { if (!sorted.includes(p)) { sorted.push(p); const partner = people.find(x => x.id === p.partner); if(partner && !sorted.includes(partner)) sorted.push(partner); }});
      sorted.forEach((p, i) => { order.set(p.id, i); nodes.push({ id: p.id, type: 'person', position: {x: i * 258 - (sorted.length - 1) * 129, y: level * 246}, data: {person: p, root: p.id === tree.rootId, dim: !!query && !matchesPerson(p,query), onSelect} }); });
    });
    tree.people.forEach(p => {
      p.parents.forEach(id => { if(tree.people.some(x => x.id === id)) edges.push({id:`${id}-${p.id}`,source:id,target:p.id,sourceHandle:'child',targetHandle:'parent',type:'smoothstep',style:{stroke:'#a3b5a3',strokeWidth:1.5}}); });
      if(p.partner && (order.get(p.id) ?? 0) < (order.get(p.partner) ?? 0)) edges.push({id:`spouse-${p.id}`,source:p.id,target:p.partner,sourceHandle:'partner-right',targetHandle:'partner-left',type:'straight',label:'♡',labelStyle:{fill:'#b28d75',fontSize:22},labelBgStyle:{fill:'#fbfcf9'},labelBgPadding:[6,2],style:{stroke:'#b6bca9',strokeWidth:1.5,strokeDasharray:'4 4'}});
    });
    return {nodes, edges};
  }, [tree, query, onSelect]);
  if (!tree.people.length) return <div className="empty-state tree-empty"><span className="empty-icon"><Sprout size={38}/></span><h2>Велика історія починається з вас</h2><p>Додайте першу людину — корінь вашого дерева.<br/>А потім поєднайте покоління.</p><button className="btn primary" onClick={onAdd}><Plus size={17}/>Додати першу людину</button></div>;
  return <div className="flow-container">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{padding:0.18,maxZoom:0.85}} minZoom={0.15} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} onMove={(_,v) => setZoom(v.zoom)} proOptions={{hideAttribution:true}}>
      <Background color="#cbd2c7" gap={22} size={1}/>
    </ReactFlow>
    <div className="generation-labels" aria-hidden="true">{Array.from({length:Math.max(...generationMap(tree.people).values())+1},(_,i)=><span key={i}>{i+1} покоління</span>)}</div>
    <div className="canvas-legend"><span className="legend-line"/>Родинний зв’язок<span className="legend-dot"/>Корінь дерева</div>
    <div className="canvas-controls"><button onClick={() => flow.zoomOut()} aria-label="Зменшити масштаб"><Minus size={17}/></button><span>{Math.round(zoom*100)}%</span><button onClick={() => flow.zoomIn()} aria-label="Збільшити масштаб"><Plus size={17}/></button><i/><button onClick={() => flow.fitView({padding:0.18,maxZoom:0.85,duration:350})} aria-label="Показати все дерево"><Maximize size={17}/></button><button onClick={() => { const node = flow.getNode(tree.rootId); if(node) flow.setCenter(node.position.x+94,node.position.y+96,{zoom:1,duration:400}); }} aria-label="Перейти до кореня"><LocateFixed size={17}/></button></div>
    <div className="canvas-hint"><UserRound size={13}/>Натисніть на людину, щоб дізнатися більше</div>
  </div>;
}
export default function FamilyCanvas(props: Parameters<typeof Canvas>[0]) { return <ReactFlowProvider key={props.tree.id}><Canvas {...props}/></ReactFlowProvider>; }
