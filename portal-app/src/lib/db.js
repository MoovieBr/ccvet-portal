/* Camada de dados — Firestore, Storage e operações privilegiadas. */
import React from "react";
import {
  collection, doc, onSnapshot, query, orderBy, where,
  addDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp
} from "firebase/firestore";
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "./firebase.js";

/* ---------- hooks de leitura (tempo real) ---------- */

// Assina uma coleção; retorna null enquanto carrega, depois [{id, ...data}].
// Com enabled=false não assina (usuário sem permissão) e retorna [].
export function useCol(nome, orderField, enabled = true) {
  const [itens, setItens] = React.useState(enabled ? null : []);
  React.useEffect(() => {
    if (!enabled) { setItens([]); return; }
    const col = collection(db, nome);
    const q = orderField ? query(col, orderBy(orderField)) : col;
    return onSnapshot(q, (snap) => {
      setItens(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Erro ao ler " + nome, err);
      setItens([]);
    });
  }, [nome, orderField, enabled]);
  return itens;
}

// Assina os docs de uma coleção filtrados por um campo (ordenação no cliente).
export function useColFiltrada(nome, campo, valor) {
  const [itens, setItens] = React.useState(null);
  React.useEffect(() => {
    if (!valor) { setItens([]); return; }
    const q = query(collection(db, nome), where(campo, "==", valor));
    return onSnapshot(q, (snap) => {
      setItens(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Erro ao ler " + nome, err);
      setItens([]);
    });
  }, [nome, campo, valor]);
  return itens;
}

// Assina um documento; retorna undefined enquanto carrega, null se não existe.
export function useDoc(caminho) {
  const [item, setItem] = React.useState(undefined);
  React.useEffect(() => {
    return onSnapshot(doc(db, caminho), (snap) => {
      setItem(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (err) => {
      console.error("Erro ao ler " + caminho, err);
      setItem(null);
    });
  }, [caminho]);
  return item;
}

/* ---------- escrita genérica ---------- */

export const criar = (col, data) => addDoc(collection(db, col), data);
export const gravar = (caminho, data) => setDoc(doc(db, caminho), data);
export const atualizar = (caminho, data) => updateDoc(doc(db, caminho), data);
export const excluir = (caminho) => deleteDoc(doc(db, caminho));

// Troca a posição de dois módulos (campo `ordem`) numa operação atômica.
export function trocarOrdem(a, b) {
  const batch = writeBatch(db);
  batch.update(doc(db, "modulos/" + a.id), { ordem: b.ordem });
  batch.update(doc(db, "modulos/" + b.id), { ordem: a.ordem });
  return batch.commit();
}

/* ---------- apostilas (Storage) ---------- */

export function uploadApostila(moduloId, file, onProgress) {
  const path = "apostilas/" + moduloId + "/" + file.name;
  const task = uploadBytesResumable(sRef(storage, path), file, { contentType: "application/pdf" });
  return new Promise((resolve, reject) => {
    task.on("state_changed",
      (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        const mb = (file.size / 1048576).toFixed(1).replace(".", ",") + " MB";
        await atualizar("modulos/" + moduloId, { apostila: { path, arquivo: file.name, tamanho: mb } });
        resolve(path);
      }
    );
  });
}

export function urlApostila(path) {
  return getDownloadURL(sRef(storage, path));
}

export async function removerApostilaArquivo(path) {
  try { await deleteObject(sRef(storage, path)); } catch (e) { /* arquivo já ausente */ }
}

/* ---------- logs (estatísticas) ---------- */

export function registrarLog(alunoId, moduloId, tipo) {
  return criar("logs", { alunoId, moduloId, tipo, timestamp: serverTimestamp() })
    .catch((e) => console.error("Erro ao registrar log", e));
}

/* ---------- Operações privilegiadas (fila `tarefas`) ----------
 * A organização do Firebase bloqueia endpoints públicos, então em vez de
 * funções chamáveis o painel grava um doc em `tarefas` e espera a Cloud
 * Function processar e devolver o resultado no mesmo doc. */

function executarTarefa(tipo, payload) {
  return new Promise(async (resolve, reject) => {
    let ref;
    try {
      ref = await addDoc(collection(db, "tarefas"), {
        tipo, payload,
        autorUid: auth.currentUser.uid,
        status: "pendente",
        criadoEm: serverTimestamp(),
      });
    } catch (e) {
      reject(new Error("Você não tem permissão para esta ação."));
      return;
    }
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error("A operação demorou demais. Tente novamente."));
    }, 60000);
    const unsub = onSnapshot(ref, (snap) => {
      const t = snap.data();
      if (!t || t.status === "pendente") return;
      clearTimeout(timeout);
      unsub();
      if (t.status === "ok") resolve({ data: t.resultado });
      else reject(new Error(t.erro || "Não foi possível concluir a operação."));
    }, (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export const fnCreateAluno = (p) => executarTarefa("createAluno", p);
export const fnToggleAlunoAtivo = (p) => executarTarefa("toggleAlunoAtivo", p);
export const fnDeleteAluno = (p) => executarTarefa("deleteAluno", p);
export const fnCreateStaff = (p) => executarTarefa("createStaff", p);
export const fnToggleStaffAtivo = (p) => executarTarefa("toggleStaffAtivo", p);
export const fnDeleteStaff = (p) => executarTarefa("deleteStaff", p);
export const fnSetStaffRole = (p) => executarTarefa("setStaffRole", p);
export const fnSalvarPlano = (p) => executarTarefa("salvarPlano", p);
export const fnPagarParcela = (p) => executarTarefa("pagarParcela", p);
export const fnConferirPagamento = (p) => executarTarefa("conferirPagamento", p);
export const fnEmitirNota = (p) => executarTarefa("emitirNota", p);
export const fnConferirNota = (p) => executarTarefa("conferirNota", p);
export const fnSimularPagamento = (p) => executarTarefa("simularPagamento", p);
export const fnDefinirStatusTurma = (p) => executarTarefa("definirStatusTurma", p);
export const fnLiberarCertificado = (p) => executarTarefa("liberarCertificado", p);
export const fnMuxCriarUpload = (p) => executarTarefa("muxCriarUpload", p);
export const fnMuxConferirUpload = (p) => executarTarefa("muxConferirUpload", p);
export const fnMuxRemoverVideo = (p) => executarTarefa("muxRemoverVideo", p);

// Envia o arquivo de vídeo direto para o Mux (PUT com progresso).
export function uploadVideoMux(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
      ? resolve()
      : reject(new Error("Falha no envio do vídeo (" + xhr.status + ")."));
    xhr.onerror = () => reject(new Error("Falha de rede no envio do vídeo."));
    xhr.send(file);
  });
}

/* ---------- consulta de CEP (ViaCEP) ---------- */

// Busca o endereço pelo CEP (roda no navegador). Devolve {endereco, bairro,
// cidade, uf} ou null se o CEP for inválido/não encontrado.
export async function buscarCep(cep) {
  const num = String(cep || "").replace(/\D/g, "");
  if (num.length !== 8) return null;
  try {
    const res = await fetch("https://viacep.com.br/ws/" + num + "/json/");
    if (!res.ok) return null;
    const j = await res.json();
    if (j.erro) return null;
    return { endereco: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
  } catch (e) {
    return null;
  }
}

/* ---------- comentários das aulas ---------- */

export function comentar(moduloId, autorUid, autorNome, autorPapel, texto) {
  return criar("comentarios", {
    moduloId, autorUid, autorNome, autorPapel,
    texto: texto.trim().slice(0, 2000),
    criadoEm: serverTimestamp(),
  });
}
