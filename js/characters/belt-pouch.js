const DEFAULT_COIN_TYPES = ["PP", "GP", "SP", "CP", "EP", "Gems"];

function createDefaultBeltPouch() {
  const coinAmounts = {};
  DEFAULT_COIN_TYPES.forEach(type => {
    coinAmounts[type] = 0;
  });

  return {
    name: "Coin Purse",
    slots: 1,
    head: true,
    hasCoinSlots: true,
    coinLimit: 50,
    coinTypes: [...DEFAULT_COIN_TYPES],
    coinAmounts
  };
}

function ensureBeltPouch(char) {
  let changed = false;

  if (!Array.isArray(char.beltPouch)) {
    const existing = char.beltPouch && typeof char.beltPouch === "object" && char.beltPouch.head
      ? { ...char.beltPouch }
      : null;
    char.beltPouch = [existing || createDefaultBeltPouch()];
    changed = true;
  }

  if (char.beltPouch.length === 0) {
    char.beltPouch.push(createDefaultBeltPouch());
    changed = true;
  } else if (char.beltPouch.length > 1) {
    char.beltPouch = [char.beltPouch[0]];
    changed = true;
  }

  const pouch = char.beltPouch[0];

  if (!pouch || typeof pouch !== "object" || !pouch.head) {
    char.beltPouch[0] = createDefaultBeltPouch();
    return true;
  }

  if (pouch.slots !== 1) {
    pouch.slots = 1;
    changed = true;
  }

  if (typeof pouch.name !== "string" || !pouch.name.trim()) {
    pouch.name = "Coin Purse";
    changed = true;
  }

  if (!pouch.hasCoinSlots) {
    pouch.hasCoinSlots = true;
    changed = true;
  }

  if (!Array.isArray(pouch.coinTypes) || pouch.coinTypes.length === 0) {
    pouch.coinTypes = [...DEFAULT_COIN_TYPES];
    changed = true;
  }

  if (!pouch.coinAmounts || typeof pouch.coinAmounts !== "object") {
    pouch.coinAmounts = {};
    changed = true;
  }

  pouch.coinTypes.forEach(type => {
    if (typeof pouch.coinAmounts[type] !== "number" || Number.isNaN(pouch.coinAmounts[type])) {
      pouch.coinAmounts[type] = 0;
      changed = true;
    }
  });

  if (pouch.coinLimit !== 50) {
    pouch.coinLimit = 50;
    changed = true;
  }

  return changed;
}

export { createDefaultBeltPouch, ensureBeltPouch };
