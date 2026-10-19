import { useState } from "react";
import { Popover, type Anchor } from "./ui";

const GROUPS: { name: string; emojis: string }[] = [
  { name: "Frequentes", emojis: "📄 📝 📚 💼 📌 ⭐ ✅ 💡 🎯 🔥 📅 🗂️ 📊 🧠 🚀 🏠 ❤️ 🎓 💻 🔖" },
  { name: "Estudo e trabalho", emojis: "📖 📕 📗 📘 📙 📓 📔 📒 📃 📜 📑 🧾 📋 📁 📂 🗃️ 🗄️ 📈 📉 🧮 ✏️ ✒️ 🖊️ 🖋️ 🖍️ 📐 📏 🔬 🔭 🧪 🧬 ⚗️ 🧑‍🏫 🧑‍💻 🧑‍🎓 🏫 🏢 🗓️ ⏰ ⏳ ⌛ 📎 🖇️ 🔍 🔎 🔒 🔑 🗝️ 📮 📬 📧 💬 🗨️ 💭 🗣️ 📣 📢" },
  { name: "Tecnologia", emojis: "💻 🖥️ ⌨️ 🖱️ 💾 💿 📱 📲 ☎️ 📞 🔌 🔋 🛰️ 📡 🤖 👾 🕹️ 🎮 🧩 ⚙️ 🛠️ 🔧 🔨 🪛 🧰 🧲 💽 🗜️" },
  { name: "Símbolos", emojis: "✅ ☑️ ✔️ ❌ ❎ ⚠️ 🚫 ❗ ❓ ‼️ ⁉️ 💯 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 ⬛ ⬜ 🔶 🔷 🔸 🔹 ▶️ ⏸️ ⏹️ 🔁 🔄 ➕ ➖ ✖️ ➗ ♾️ 💲 ©️ ®️ ™️ #️⃣ 🆕 🆗 🆙 🆒 ℹ️ 🔝 🔜" },
  { name: "Natureza", emojis: "🌱 🌿 🍀 🌳 🌲 🌴 🌵 🌷 🌸 🌹 🌻 🌼 🍁 🍂 🍃 🌍 🌎 🌏 🌙 ☀️ ⭐ 🌟 ✨ ⚡ ☁️ 🌧️ ❄️ 🔥 💧 🌊 🌈 🐶 🐱 🦊 🐻 🐼 🦁 🐯 🐸 🐵 🦉 🐝 🦋 🐢 🐙 🐬" },
  { name: "Comida e lazer", emojis: "☕ 🍵 🍺 🍷 🍕 🍔 🍟 🌮 🍣 🍜 🍝 🥗 🍎 🍌 🍇 🍓 🍰 🎂 🍫 🍿 ⚽ 🏀 🏈 🎾 🏐 🏓 🎱 🏋️ 🚴 🏃 🧘 🎨 🎬 🎤 🎧 🎵 🎸 🎹 🎲 ♟️ ✈️ 🚗 🚲 🚆 ⛵ 🏖️ 🏔️ 🗺️ 🎁 🎉" },
  { name: "Pessoas", emojis: "😀 😃 😄 😁 😆 😅 😂 🙂 😉 😊 😇 🥰 😍 🤩 😎 🤓 🧐 🤔 🤨 😐 😴 😷 🤯 🥳 😤 😢 😭 😱 👍 👎 👏 🙌 🙏 💪 👀 👋 ✌️ 🤝 👤 👥 👨‍👩‍👧 💑 🧑 👩 👨 👶" },
];

export function EmojiPicker({
  anchor,
  onPick,
  onClose,
  onRemove,
}: {
  anchor: Anchor;
  onPick: (emoji: string) => void;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <Popover anchor={anchor} onClose={onClose} width={360}>
      <div className="row" style={{ marginBottom: 6 }}>
        <input
          className="input"
          placeholder="Cole ou digite um emoji…"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) {
              onPick(custom.trim());
              onClose();
            }
          }}
          style={{ flex: 1 }}
        />
        {onRemove && (
          <button
            className="btn"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            Remover
          </button>
        )}
      </div>
      {GROUPS.map((g) => (
        <div key={g.name}>
          <div className="menu-label">{g.name}</div>
          <div className="emoji-grid">
            {g.emojis.split(" ").map((e, i) => (
              <button
                key={g.name + i}
                onClick={() => {
                  onPick(e);
                  onClose();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Popover>
  );
}

export const RANDOM_ICONS = "📄 📝 📚 💡 🎯 📌 🗂️ 🧠 🚀 📊 🌱 ⭐".split(" ");
