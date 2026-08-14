import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  atualizarCliente,
  buscarCliente,
  criarCliente,
} from '../../services/clientesService';
import { listarServicos } from '../../services/servicosService';
import { formatarCnpj, rotuloUnidade, UNIDADES } from '../../utils/formatadores';
import { somenteDigitos, validarCnpj } from '../../utils/validadores';

const clienteVazio = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  endereco: { logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '' },
  contatoPrincipal: '',
  telefone: '',
  email: '',
  subclientes: [],
  tabelaPrecos: [],
  prazoPadraoDias: 15,
  ativo: true,
};

export default function ClienteForm() {
  const { id } = useParams();
  const ehNovo = !id;
  const navegar = useNavigate();
  const { usuario, ehAdministrador } = useAuth();

  const [cliente, setCliente] = useState(clienteVazio);
  const [servicos, setServicos] = useState([]);
  const [aba, setAba] = useState('dados');
  const [carregando, setCarregando] = useState(!ehNovo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarServicos().then(setServicos).catch(() => {});
    if (!ehNovo) {
      buscarCliente(id)
        .then((registro) => {
          if (registro) {
            setCliente({ ...clienteVazio, ...registro, cnpj: formatarCnpj(registro.cnpj) });
          } else {
            setErro('Cliente não encontrado.');
          }
        })
        .catch(() => setErro('Não foi possível carregar o cliente.'))
        .finally(() => setCarregando(false));
    }
  }, [id, ehNovo]);

  function alterar(campo, valor) {
    setCliente((atual) => ({ ...atual, [campo]: valor }));
  }

  function alterarEndereco(campo, valor) {
    setCliente((atual) => ({ ...atual, endereco: { ...atual.endereco, [campo]: valor } }));
  }

  // ---------- Subclientes ----------
  function adicionarSubcliente() {
    alterar('subclientes', [
      ...cliente.subclientes,
      { id: crypto.randomUUID(), nome: '', observacao: '', ativo: true },
    ]);
  }

  function alterarSubcliente(indice, campo, valor) {
    const lista = cliente.subclientes.map((s, i) =>
      i === indice ? { ...s, [campo]: valor } : s
    );
    alterar('subclientes', lista);
  }

  function removerSubcliente(indice) {
    alterar('subclientes', cliente.subclientes.filter((_, i) => i !== indice));
  }

  // ---------- Tabela de preços ----------
  function adicionarPreco() {
    const primeiro = servicos[0];
    alterar('tabelaPrecos', [
      ...cliente.tabelaPrecos,
      {
        servicoCodigo: primeiro ? primeiro.codigo : '',
        unidade: primeiro ? primeiro.unidadePadrao : 'm2',
        preco: 0,
      },
    ]);
  }

  function alterarPreco(indice, campo, valor) {
    const lista = cliente.tabelaPrecos.map((p, i) => {
      if (i !== indice) return p;
      const novo = { ...p, [campo]: valor };
      // Ao trocar o serviço, sugere a unidade padrão dele
      if (campo === 'servicoCodigo') {
        const servico = servicos.find((s) => s.codigo === valor);
        if (servico) novo.unidade = servico.unidadePadrao;
      }
      return novo;
    });
    alterar('tabelaPrecos', lista);
  }

  function removerPreco(indice) {
    alterar('tabelaPrecos', cliente.tabelaPrecos.filter((_, i) => i !== indice));
  }

  // ---------- Salvar ----------
  async function aoSalvar(evento) {
    evento.preventDefault();
    if (!cliente.razaoSocial.trim()) {
      setErro('Informe a razão social do cliente.');
      setAba('dados');
      return;
    }
    if (cliente.cnpj && !validarCnpj(cliente.cnpj)) {
      setErro('O CNPJ informado não é válido. Confira os dígitos.');
      setAba('dados');
      return;
    }
    setSalvando(true);
    setErro('');
    const dados = {
      ...cliente,
      razaoSocial: cliente.razaoSocial.trim(),
      prazoPadraoDias: Number(cliente.prazoPadraoDias) || 0,
      subclientes: cliente.subclientes.filter((s) => s.nome.trim()),
      tabelaPrecos: cliente.tabelaPrecos
        .filter((p) => p.servicoCodigo)
        .map((p) => ({ ...p, preco: Number(p.preco) || 0 })),
    };
    delete dados.id;
    try {
      if (ehNovo) {
        await criarCliente(dados, usuario.uid);
      } else {
        await atualizarCliente(id, dados, usuario.uid);
      }
      navegar('/clientes');
    } catch (excecao) {
      if (excecao.message === 'cnpj-duplicado') {
        setErro('Já existe um cliente com este CNPJ. Verifique o cadastro existente.');
        setAba('dados');
      } else {
        setErro('Não foi possível salvar. Verifique sua permissão e tente novamente.');
      }
      setSalvando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando cliente...</div>;

  const somenteLeitura = !ehAdministrador;

  return (
    <form onSubmit={aoSalvar}>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">{ehNovo ? 'Novo cliente' : cliente.razaoSocial}</h1>
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}

      <div className="abas">
        <button
          type="button"
          className={aba === 'dados' ? 'aba ativa' : 'aba'}
          onClick={() => setAba('dados')}
        >
          Dados
        </button>
        <button
          type="button"
          className={aba === 'subclientes' ? 'aba ativa' : 'aba'}
          onClick={() => setAba('subclientes')}
        >
          Subclientes ({cliente.subclientes.length})
        </button>
        <button
          type="button"
          className={aba === 'precos' ? 'aba ativa' : 'aba'}
          onClick={() => setAba('precos')}
        >
          Tabela de preços ({cliente.tabelaPrecos.length})
        </button>
      </div>

      {aba === 'dados' && (
        <div className="cartao">
          <fieldset disabled={somenteLeitura} style={{ border: 'none' }}>
            <div className="grade-formulario">
              <div className="campo campo-largo">
                <label htmlFor="razaoSocial">Razão social *</label>
                <input
                  id="razaoSocial"
                  value={cliente.razaoSocial}
                  onChange={(e) => alterar('razaoSocial', e.target.value)}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="nomeFantasia">Nome fantasia</label>
                <input
                  id="nomeFantasia"
                  value={cliente.nomeFantasia}
                  onChange={(e) => alterar('nomeFantasia', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="cnpj">CNPJ</label>
                <input
                  id="cnpj"
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  value={cliente.cnpj}
                  onChange={(e) => alterar('cnpj', formatarCnpj(e.target.value))}
                />
              </div>
              <div className="campo">
                <label htmlFor="inscricao">Inscrição estadual</label>
                <input
                  id="inscricao"
                  value={cliente.inscricaoEstadual}
                  onChange={(e) => alterar('inscricaoEstadual', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="contato">Contato principal</label>
                <input
                  id="contato"
                  value={cliente.contatoPrincipal}
                  onChange={(e) => alterar('contatoPrincipal', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="telefone">Telefone</label>
                <input
                  id="telefone"
                  type="tel"
                  value={cliente.telefone}
                  onChange={(e) => alterar('telefone', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  value={cliente.email}
                  onChange={(e) => alterar('email', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="prazo">Prazo padrão de entrega (dias)</label>
                <input
                  id="prazo"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={cliente.prazoPadraoDias}
                  onChange={(e) => alterar('prazoPadraoDias', e.target.value)}
                />
              </div>

              <div className="campo campo-largo">
                <label htmlFor="logradouro">Endereço</label>
                <input
                  id="logradouro"
                  placeholder="Logradouro"
                  value={cliente.endereco.logradouro}
                  onChange={(e) => alterarEndereco('logradouro', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="numero">Número</label>
                <input
                  id="numero"
                  value={cliente.endereco.numero}
                  onChange={(e) => alterarEndereco('numero', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="bairro">Bairro</label>
                <input
                  id="bairro"
                  value={cliente.endereco.bairro}
                  onChange={(e) => alterarEndereco('bairro', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="cidade">Cidade</label>
                <input
                  id="cidade"
                  value={cliente.endereco.cidade}
                  onChange={(e) => alterarEndereco('cidade', e.target.value)}
                />
              </div>
              <div className="campo">
                <label htmlFor="uf">UF</label>
                <input
                  id="uf"
                  maxLength={2}
                  value={cliente.endereco.uf}
                  onChange={(e) => alterarEndereco('uf', e.target.value.toUpperCase())}
                />
              </div>
              <div className="campo">
                <label htmlFor="cep">CEP</label>
                <input
                  id="cep"
                  inputMode="numeric"
                  value={cliente.endereco.cep}
                  onChange={(e) => alterarEndereco('cep', e.target.value)}
                />
              </div>
              <div className="campo campo-caixa">
                <label>
                  <input
                    type="checkbox"
                    checked={cliente.ativo}
                    onChange={(e) => alterar('ativo', e.target.checked)}
                  />{' '}
                  Cliente ativo
                </label>
              </div>
            </div>
          </fieldset>
        </div>
      )}

      {aba === 'subclientes' && (
        <div className="cartao">
          <p className="texto-apoio" style={{ marginBottom: 12 }}>
            Subcliente é o cliente final do cliente (obra ou destino da peça). A lista
            aparece como sugestão na abertura da OS.
          </p>
          {cliente.subclientes.map((subcliente, indice) => (
            <div className="linha-subitem" key={subcliente.id}>
              <div className="campo">
                <label>Nome</label>
                <input
                  value={subcliente.nome}
                  onChange={(e) => alterarSubcliente(indice, 'nome', e.target.value)}
                  disabled={somenteLeitura}
                />
              </div>
              <div className="campo">
                <label>Observação</label>
                <input
                  value={subcliente.observacao}
                  onChange={(e) => alterarSubcliente(indice, 'observacao', e.target.value)}
                  disabled={somenteLeitura}
                />
              </div>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="botao-remover"
                  onClick={() => removerSubcliente(indice)}
                  aria-label="Remover subcliente"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {cliente.subclientes.length === 0 && (
            <p className="texto-apoio">Nenhum subcliente cadastrado.</p>
          )}
          {!somenteLeitura && (
            <button
              type="button"
              className="botao-secundario"
              style={{ marginTop: 12 }}
              onClick={adicionarSubcliente}
            >
              Adicionar subcliente
            </button>
          )}
        </div>
      )}

      {aba === 'precos' && (
        <div className="cartao">
          <p className="texto-apoio" style={{ marginBottom: 12 }}>
            Preço acordado com este cliente por serviço. Quando não houver, o sistema usa
            o preço padrão do serviço. O preço é sempre editável no item da OS.
          </p>
          {cliente.tabelaPrecos.map((preco, indice) => (
            <div className="linha-subitem" key={indice}>
              <div className="campo">
                <label>Serviço</label>
                <select
                  value={preco.servicoCodigo}
                  onChange={(e) => alterarPreco(indice, 'servicoCodigo', e.target.value)}
                  disabled={somenteLeitura}
                >
                  {servicos.map((s) => (
                    <option key={s.codigo} value={s.codigo}>
                      {s.codigo} — {s.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label>Unidade</label>
                <select
                  value={preco.unidade}
                  onChange={(e) => alterarPreco(indice, 'unidade', e.target.value)}
                  disabled={somenteLeitura}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>
                      {u.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label>Preço (R$ por {rotuloUnidade(preco.unidade)})</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={preco.preco}
                  onChange={(e) => alterarPreco(indice, 'preco', e.target.value)}
                  disabled={somenteLeitura}
                />
              </div>
              {!somenteLeitura && (
                <button
                  type="button"
                  className="botao-remover"
                  onClick={() => removerPreco(indice)}
                  aria-label="Remover preço"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {cliente.tabelaPrecos.length === 0 && (
            <p className="texto-apoio">Nenhum preço específico cadastrado.</p>
          )}
          {!somenteLeitura && (
            <button
              type="button"
              className="botao-secundario"
              style={{ marginTop: 12 }}
              onClick={adicionarPreco}
              disabled={servicos.length === 0}
            >
              Adicionar preço
            </button>
          )}
        </div>
      )}

      <div className="acoes-rodape">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => navegar('/clientes')}
          disabled={salvando}
        >
          Voltar
        </button>
        {!somenteLeitura && (
          <button type="submit" className="botao-primario botao-acao" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar cliente'}
          </button>
        )}
      </div>
    </form>
  );
}
