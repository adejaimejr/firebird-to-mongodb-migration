# Firebird to MongoDB Migration Tool

Uma ferramenta robusta e automatizada para migrar dados de bancos Firebird para MongoDB, com suporte especial para o ERP Millenium da Linx.

## 🚀 Características

- ✨ Migração automática de qualquer banco Firebird para MongoDB
- 📦 Suporte para arquivos de backup GBK do Firebird
- 🔄 Processamento incremental (migra apenas backups novos)
- 🎯 Otimizado para o ERP Millenium da Linx
- 📊 Tratamento inteligente de tabelas grandes
- 📝 Sistema de logging detalhado
- 🛡️ Verificação automática de dependências

## 📋 Pré-requisitos

- Python 3.8+
- Node.js 18+
- npm 6+
- Firebird 3.0
- MongoDB 4.4+

## 🛠️ Instalação

1. Clone o repositório:
```bash
git clone https://github.com/adejaimejr/firebird-to-mongodb-migration.git
cd firebird-to-mongodb-migration
```

2. Instale as dependências do Node.js:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Crie a estrutura de diretórios:
```bash
mkdir -p firebird/restored
mkdir -p gbk
```

## 📁 Estrutura do Projeto

```
.
├── firebird/
│   └── restored/     # Banco restaurado temporariamente
├── gbk/              # Arquivos de backup (.gbk)
├── src/
│   ├── migration/    # Código TypeScript da migração
│   └── ...
├── automacao.py      # Script principal de automação
├── .env             # Configurações do ambiente
└── package.json     # Dependências Node.js
```

## 🚦 Uso

1. Coloque seus arquivos de backup (.gbk) na pasta `gbk/`

2. Execute o script de automação:
```bash
python automacao.py
```

O script irá:
- Verificar se há novos arquivos de backup
- Restaurar o backup mais recente
- Migrar todas as tabelas para MongoDB
- Registrar o arquivo processado

## 🕒 Agendamento

Para executar a migração automaticamente a cada 1 hora:

1. Abra o PowerShell como Administrador

2. Navegue até o diretório do projeto:
```powershell
cd caminho/do/projeto
```

3. Execute o script de configuração:
```powershell
.\setup_scheduler.ps1
```

O script irá:
- Criar uma tarefa agendada no Windows
- Executar a migração a cada 1 hora
- Usar privilégios de sistema para garantir acesso

Para verificar o status:
1. Abra o Agendador de Tarefas do Windows
2. Procure por "FirebirdToMongoMigration"
3. Verifique o histórico de execuções

Para desativar o agendamento:
```powershell
Unregister-ScheduledTask -TaskName "FirebirdToMongoMigration" -Confirm:$false
```

## ⚙️ Configuração

Edite o arquivo `.env` com suas configurações:

- `FIREBIRD_HOST`: Host do servidor Firebird
- `FIREBIRD_PORT`: Porta do Firebird (padrão: 3050)
- `FIREBIRD_USER`: Usuário do Firebird
- `FIREBIRD_PASSWORD`: Senha do Firebird
- `MONGO_URI`: URI de conexão do MongoDB

## 📊 Tabelas Grandes

O sistema possui tratamento especial para tabelas grandes:
- Tamanho padrão do lote: 25.000 registros
- Tamanho reduzido para tabelas grandes: 1.000 registros
- Ajuste automático em caso de documentos muito grandes

## 📝 Logs

Os logs são gerados com informações detalhadas sobre:
- Progresso da migração
- Erros e exceções
- Estatísticas de processamento
- Arquivos processados

## 🔍 Exemplo: ERP Millenium

Este projeto foi otimizado para trabalhar com o ERP e-Millenium da Linx, mas pode ser usado com qualquer banco Firebird. Para o e-Millenium:

1. Configure o backup automático no e-Millenium para gerar arquivos .gbk
2. Coloque os arquivos na pasta `gbk/`
3. Execute a migração
4. Os dados estarão disponíveis no MongoDB com a mesma estrutura

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, siga estes passos:

1. Faça um fork do projeto
2. Crie sua branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## ✨ Agradecimentos

- Equipe i92Tech
- Comunidade Firebird
- Comunidade MongoDB

## 🔗 Links

- Repositório: [https://github.com/adejaimejr/firebird-to-mongodb-migration](https://github.com/adejaimejr/firebird-to-mongodb-migration)
- Issues: [https://github.com/adejaimejr/firebird-to-mongodb-migration/issues](https://github.com/adejaimejr/firebird-to-mongodb-migration/issues)
- Pull Requests: [https://github.com/adejaimejr/firebird-to-mongodb-migration/pulls](https://github.com/adejaimejr/firebird-to-mongodb-migration/pulls)
