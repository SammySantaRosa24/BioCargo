# BioCargo — Frontend

Frontend público da BioCargo, uma plataforma que conecta empresas a motoristas PJ especializados no transporte de materiais biológicos.

## Tecnologias

- React e JavaScript
- Vite
- React Router DOM
- CSS puro

## Requisitos

- Node.js instalado
- npm

## Instalar dependências

No terminal, acesse a pasta `frontend` e instale as dependências registradas no projeto:

```bash
npm install
```

No PowerShell do Windows, se a política de execução impedir o comando `npm`, use:

```powershell
npm.cmd install
```

## Executar em desenvolvimento

Dentro de `frontend`, inicie o servidor local:

```bash
npm run dev
```

No PowerShell do Windows, também é possível usar `npm.cmd run dev`. Abra no navegador o endereço local informado pelo Vite, normalmente `http://localhost:5173`.

## Gerar build de produção

Para compilar os arquivos de produção:

```bash
npm run build
```

No PowerShell do Windows, use `npm.cmd run build` se necessário. O resultado será gerado na pasta `dist/`.
