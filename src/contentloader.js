let contentMap = {};

export async function loadContent(url = './data/nodes.pt-BR.json'){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error('Falha ao carregar conteúdo: ' + res.status);
  contentMap = await res.json();
  return contentMap;
}

export function getContent(id){
  return contentMap[id] || null;
}

export function getAllContent(){
  return contentMap;
}
