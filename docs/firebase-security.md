# Segurança por sala

## Ativar no Firebase

1. Em **Authentication → Sign-in method → Adicionar provedor**, habilite **Anônimo**. O app cria uma identidade persistente para o navegador, sem tela de cadastro.
2. Publique a versão atualizada do app e, em **Realtime Database → Regras**, substitua todas as regras pelo conteúdo de `database.rules.json` e clique em **Publicar**. Faça essa troca em uma pausa das partidas: o app antigo é incompatível com as novas regras.
3. Crie salas novas. As salas antigas não têm um dono autenticado e não são assumidas automaticamente por segurança. Não é necessário apagar dados antigos para criar salas novas.
4. Abra o anfitrião em um navegador e entre pelo QR/código em outro navegador ou dispositivo. Confira entrada, apostas, saída, bots e retorno do anfitrião à mesma sala.

Os arquivos locais não alteram as regras em produção. Se preferir publicar pela CLI autenticada, use `npx firebase deploy --only database --project SEU_PROJECT_ID`.

## Permissões

- A raiz do banco e a listagem global de salas ficam bloqueadas.
- Cada sala guarda um `hostUid` imutável. Somente esse UID publica o estado, administra ou apaga a sala.
- O código de seis caracteres funciona como convite: um usuário autenticado que conhece o código pode registrar a própria participação e ler a sala. Não há aprovação manual do anfitrião.
- Cada participante envia um pedido por vez, sob seu próprio UID. As regras validam os campos e o anfitrião verifica o vínculo entre UID e jogador antes de executar a ação.
- Os jogadores aguardam a confirmação do anfitrião; a mesa do anfitrião deve permanecer aberta para processar pedidos.
- O diretório de salas é privado por anfitrião. O limite de dez salas é aplicado pelo app para cada anfitrião, não como uma cota global protegida no servidor.
- Consultar o horário de atividade de um código específico é permitido a usuários autenticados, para verificar se a sala existe antes da entrada. Isso não permite listar códigos.

## Identidade e limitações

O dono da sala é o usuário anônimo persistido no navegador. Limpar os dados do site ou trocar de navegador perde essa identidade; o histórico local sozinho não concede acesso de anfitrião. Usuários do mesmo perfil de navegador compartilham identidade, inclusive entre abas. Use outro navegador ou dispositivo para simular participantes independentes.

O estado da partida ainda inclui cartas e baralho completos. O isolamento por sala impede acesso de quem não participa, mas não esconde cartas de outros participantes que inspecionem os dados. Privacidade de cartas exige separar o estado público das mãos privadas. O anfitrião continua sendo uma autoridade confiável para o jogo. App Check e processamento em backend são melhorias adicionais para combater abuso e trapaça.

## Testes locais

```sh
npx tsc --noEmit
npm run build
npm run test:game
npm run test:rules
```

Os testes de regras usam o projeto fictício `demo-poker-air` e o emulador local; não acessam o banco de produção. O emulador requer Java 17 ou superior com a versão 14 do Firebase CLI configurada no projeto. O primeiro uso baixa o emulador.
