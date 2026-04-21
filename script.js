/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const rtlToggle = document.getElementById("rtlToggle");
const enableWebSearch = document.getElementById("enableWebSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

let allProducts = [];
let currentProducts = [];
let selectedProducts = [];
let isRTLMode = false;
const expandedProductIds = new Set();
let chatMessages = [];

const WORKER_ENDPOINT_URL =
  typeof WORKER_ENDPOINT_URL !== "undefined" ? WORKER_ENDPOINT_URL : "";
const STORAGE_KEY = "loreal-selected-product-ids";
const RTL_STORAGE_KEY = "loreal-rtl-mode";
const WEB_SEARCH_STORAGE_KEY = "loreal-web-search-enabled";
const clearSelectedButton = document.getElementById("clearSelectedProducts");
const systemMessage = {
  role: "system",
  content:
    "You are a friendly beauty routine expert. Answer only about the generated routine or related topics such as skincare, haircare, makeup, fragrance, and product care. Use the full chat history to make your responses relevant and consistent. If the user asks about unrelated topics, gently steer them back to the product routine or related beauty guidance.",
};

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (allProducts.length > 0) {
    return allProducts;
  }

  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

function isDescriptionExpanded(productId) {
  return expandedProductIds.has(productId);
}

function getSavedProductIds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}

function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
}

function restoreSavedProducts() {
  const savedIds = getSavedProductIds();
  if (!savedIds.length || !allProducts.length) {
    return;
  }

  selectedProducts = allProducts.filter((product) =>
    savedIds.includes(product.id),
  );
}

function updateClearButton() {
  if (!clearSelectedButton) return;
  if (selectedProducts.length > 0) {
    clearSelectedButton.classList.add("show");
  } else {
    clearSelectedButton.classList.remove("show");
  }
}

function clearAllSelectedProducts() {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedProducts();
  displayProducts(currentProducts);
}

function displayProducts(products) {
  currentProducts = products;

  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found. Try a different category or search term.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const selectedClass = isProductSelected(product.id) ? "selected" : "";
      const descriptionClass = isDescriptionExpanded(product.id)
        ? "show-description"
        : "";
      const buttonLabel = isDescriptionExpanded(product.id)
        ? "Hide description"
        : "View description";

      return `
        <div class="product-card ${selectedClass} ${descriptionClass}" data-product-id="${product.id}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <div>
              <h3>${product.name}</h3>
              <p class="brand">${product.brand}</p>
            </div>
            <button type="button" class="toggle-description" data-product-id="${product.id}" aria-expanded="${isDescriptionExpanded(product.id)}">
              ${buttonLabel}
            </button>
            <p class="product-description">${product.description}</p>
          </div>
        </div>
      `;
    })
    .join("");
}

function appendChatMessage(role, message) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}`;
  messageElement.innerHTML = `<p>${message}</p>`;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateChatWindow() {
  chatWindow.innerHTML = "";
  chatMessages.forEach((message) => {
    const messageElement = document.createElement("div");
    messageElement.className = `chat-message ${message.role}`;
    messageElement.innerHTML = `<p>${message.content}</p>`;
    chatWindow.appendChild(messageElement);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function getSelectedProductData() {
  return selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));
}

function getRoutinePrompt() {
  const selectedProductData = getSelectedProductData();
  return `Create a personalized beauty routine using only these selected products. Provide a step-by-step routine and explain how each product fits into the user's routine. Keep the response focused on skincare, haircare, makeup, fragrance, and other related beauty guidance. Here are the selected products:\n\n${JSON.stringify(
    selectedProductData,
    null,
    2,
  )}`;
}

async function callOpenAI(messages) {
  if (!WORKER_ENDPOINT_URL) {
    throw new Error(
      "Worker endpoint URL is missing. Add WORKER_ENDPOINT_URL to secrets.js.",
    );
  }

  const response = await fetch(WORKER_ENDPOINT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
      temperature: 0.8,
      enableWebSearch: enableWebSearch.checked,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Worker request failed.");
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function generateRoutine() {
  if (selectedProducts.length === 0) {
    appendChatMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  const userRoutineMessage = {
    role: "user",
    content: getRoutinePrompt(),
  };
  chatMessages.push(userRoutineMessage);
  updateChatWindow();

  try {
    const aiResponse = await callOpenAI([systemMessage, ...chatMessages]);
    const assistantMessage = {
      role: "assistant",
      content: aiResponse,
    };
    chatMessages.push(assistantMessage);
    updateChatWindow();
  } catch (error) {
    appendChatMessage(
      "assistant",
      `Unable to generate routine: ${error.message}`,
    );
  }
}

function addFollowUpQuestion(question) {
  if (!question.trim()) return;

  const userMessage = {
    role: "user",
    content: question,
  };
  chatMessages.push(userMessage);
  updateChatWindow();

  callOpenAI([systemMessage, ...chatMessages])
    .then((answer) => {
      const assistantMessage = {
        role: "assistant",
        content: answer,
      };
      chatMessages.push(assistantMessage);
      updateChatWindow();
    })
    .catch((error) => {
      appendChatMessage(
        "assistant",
        `Unable to answer follow-up question: ${error.message}`,
      );
    });
}

function updateSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `
      <div class="placeholder-message">
        No products selected yet.
      </div>
    `;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item">
          <span>
            <strong>${product.name}</strong> — ${product.brand}
          </span>
          <button class="remove-selected" data-product-id="${product.id}">
            Remove
          </button>
        </div>
      `,
    )
    .join("");

  updateClearButton();
}

function toggleProductSelection(productId) {
  const product = allProducts.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const existingIndex = selectedProducts.findIndex(
    (item) => item.id === productId,
  );

  if (existingIndex === -1) {
    selectedProducts.push(product);
  } else {
    selectedProducts.splice(existingIndex, 1);
  }

  saveSelectedProducts();
  updateSelectedProducts();
  displayProducts(currentProducts);
}

function toggleDescription(productId) {
  if (expandedProductIds.has(productId)) {
    expandedProductIds.delete(productId);
  } else {
    expandedProductIds.add(productId);
  }

  displayProducts(currentProducts);
}

/* Search and filter functionality */
function filterProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.toLowerCase();

  let filtered = allProducts;

  if (selectedCategory) {
    filtered = filtered.filter(
      (product) => product.category === selectedCategory,
    );
  }

  if (searchTerm) {
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm),
    );
  }

  displayProducts(filtered);
  updateClearSearchButton();
}

function updateClearSearchButton() {
  const hasSearch = productSearch.value.trim() !== "";
  if (hasSearch) {
    clearSearchBtn.classList.add("show");
  } else {
    clearSearchBtn.classList.remove("show");
  }
}

function clearSearch() {
  productSearch.value = "";
  filterProducts();
}

/* RTL Support */
function toggleRTLMode() {
  isRTLMode = !isRTLMode;
  localStorage.setItem(RTL_STORAGE_KEY, JSON.stringify(isRTLMode));

  if (isRTLMode) {
    document.body.classList.add("rtl");
    rtlToggle.textContent = "🌐 English";
  } else {
    document.body.classList.remove("rtl");
    rtlToggle.innerHTML = '<i class="fa-solid fa-language"></i> العربية';
  }
}

function loadRTLPreference() {
  const saved = localStorage.getItem(RTL_STORAGE_KEY);
  if (saved && JSON.parse(saved)) {
    isRTLMode = true;
    document.body.classList.add("rtl");
    rtlToggle.textContent = "🌐 English";
  }
}

/* Web Search Support */
function saveWebSearchPreference() {
  localStorage.setItem(WEB_SEARCH_STORAGE_KEY, JSON.stringify(enableWebSearch.checked));
}

function loadWebSearchPreference() {
  const saved = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
  if (saved && JSON.parse(saved)) {
    enableWebSearch.checked = true;
  }
}

enableWebSearch.addEventListener("change", saveWebSearchPreference);

  toggleProductSelection(productId);
});

selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-selected");
  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.productId);
  if (!productId) {
    return;
  }

  toggleProductSelection(productId);
});

categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  filterProducts();
});

productSearch.addEventListener("input", filterProducts);
clearSearchBtn.addEventListener("click", clearSearch);
rtlToggle.addEventListener("click", toggleRTLMode);

generateRoutineBtn.addEventListener("click", async () => {
  await generateRoutine();
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput");
  const question = userInput.value.trim();
  if (!question) {
    return;
  }

  addFollowUpQuestion(question);
  userInput.value = "";
});

async function init() {
  await loadProducts();
  loadRTLPreference();
  loadWebSearchPreference();
  restoreSavedProducts();
  updateSelectedProducts();
  updateChatWindow();
  updateClearButton();
}

if (clearSelectedButton) {
  clearSelectedButton.addEventListener("click", clearAllSelectedProducts);
}

init();
