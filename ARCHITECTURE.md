# Реализация троттлинга и буферизации

## Проблема

Если WebSocket отправляет данные каждые ~10мс (100+ раз/сек). Рендерить UI при каждом сообщении невозможно, т.к. браузер не справится и будет страдать производительность.

## Логическое и по ТЗ решение: буфер + троттлинг

### 1. Буферизация данных

Все входящие сообщения от WebSocket сохраняются в буфер:

```typescript
let buffer = [];

ws.onmessage = (event) => {
  const data = decode(event.data);
  buffer.push(data);
  if (buffer.length > 50) {
    buffer = buffer.slice(-50); // Ограничил размер чтобы не переполнять память при долгом подключении, плюс остаются только самые актуальные 50 строк
  }
  scheduleUpdate(set);
};
```

### 2. Троттлинг обновлений

Обновляю UI не чаще 10 раз в секунду (100мс интервал):

```typescript
const UPDATE_INTERVAL = 100;
let lastUpdate = 0;
let animationFrameId = null;

function scheduleUpdate(set) {
  if (animationFrameId) return;

  animationFrameId = requestAnimationFrame(() => {
    const now = Date.now();
    if (now - lastUpdate >= UPDATE_INTERVAL && buffer.length > 0) {
      const latest = buffer[buffer.length - 1];
      buffer = []; // Очищаю буфер после 100мс и получения актуальных данных
      set({
        bids: latest.bids,
        asks: latest.asks,
      });
      lastUpdate = now;
    }
    animationFrameId = null;
  });
}
```

### Почему requestAnimationFrame?

Использую `requestAnimationFrame` потому что:
- Синхронизируется с рендерингом браузера и монитором пользователя
- Не работает в фоновых вкладках (экономит ресурсы)
- Нет накопления вызовов при нагрузке как у `setTimeout` и `setInterval`

### Логика работы

1. Данные складываются в буфер
2. Жду минимум 100мс с последнего обновления
3. Получаю актуальные данные, очищаю буфер
4. Обновляю UI только если прошло достаточно времени

### Результат

- UI обновляется 10 раз/сек вместо 100+
- Данные не теряются в ожидании рендера - всегда показываю актуальное состояние
- Интерфейс остается плавным при любой нагрузке

      P.S. Не успел протестировать под напряжением, Binance отправляет по 1 ответу в секунду только :(
    
      По итогу не успел еще Web Worker и Drift Detection
