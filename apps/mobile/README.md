# Hermes iPhone App

Phone-native Hermes: a mobile shell for chat, voice capture, approvals, agent activity, and a self-shaping UI.

## Why

This is not a generic recorder. It is intended to become a mobile clone of the Hermes Desktop concept: same runtime, skills, memory, and tool stream — but optimized for phone-native ambient capture and prompting the app to change shape.

## Stack

- Expo SDK 56
- React Native + TypeScript
- `expo-audio` for explicit recording sessions and external mic input discovery
- `expo-blur` / `expo-linear-gradient` for the premium glass visual direction
- Hermes dashboard/TUI gateway JSON-RPC over WebSocket
- Declarative self-shaping `AppExperienceSpec`

## Run

```bash
npm install
npm start
```

For real iPhone background recording tests, use a development build rather than Expo Go.

## MVP scope

- [x] Premium ambient mobile shell
- [x] Manual capture panel with important marker
- [x] Expo audio recorder hook scaffold
- [x] Hermes JSON-RPC gateway client scaffold
- [x] Runtime self-shaping spec proof of concept
- [x] Pairing screen for Hermes backend URL/token
- [x] Stream real Hermes messages/tool events (skeleton client + mobile card renderer)
- [x] Upload capture audio segments to Hermes (multipart helper scaffold)
- [ ] Approval cards for actions/calendar/memory
- [ ] Persist upload queue + retry/resume
- [ ] Real Hermes backend endpoint for mobile capture ingestion
