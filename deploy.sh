#!/bin/bash

echo "🔨 Fazendo build..."
yarn build

echo "📦 Adicionando dist..."
git add dist -f
git commit -m "deploy"

echo "🚀 Subindo para gh-pages..."
git push origin `git subtree split --prefix dist master`:gh-pages --force

echo "🧹 Limpando dist do tracking..."
git rm -r --cached dist
git commit -m "remove dist from tracking"
git push

echo "✅ Deploy concluído! Acesse: https://lucasfujarra.github.io/Poker-Air/"