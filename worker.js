const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// Function to perform web search using a public search API
async function performWebSearch(query) {
  try {
    // Using DuckDuckGo's API as it doesn't require authentication
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Extract search results from the response
    const results = [];

    // Add AbstractText if available
    if (data.AbstractText) {
      results.push({
        title: "Summary",
        content: data.AbstractText,
        url: data.AbstractURL || "",
      });
    }

    // Add related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.slice(0, 3).forEach((topic) => {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(" - ")[0] || "Result",
            content: topic.Text,
            url: topic.FirstURL || "",
          });
        }
      });
    }

    return results.length > 0 ? results : null;
  } catch (error) {
    console.error("Web search error:", error);
    return null;
  }
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const apiKey = typeof OPENAI_API_KEY !== "undefined" ? OPENAI_API_KEY : "";
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: "OpenAI API key not configured." } }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: "Invalid JSON body." } }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const {
    messages,
    model = "gpt-4o",
    max_tokens = 500,
    temperature = 0.8,
    enableWebSearch = false,
  } = requestBody;

  if (!messages) {
    return new Response(
      JSON.stringify({
        error: { message: "Missing messages in request body." },
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  let messagesToSend = [...messages];

  // If web search is enabled, fetch search results and add them to the context
  if (enableWebSearch && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      const searchResults = await performWebSearch(lastMessage.content);

      if (searchResults && searchResults.length > 0) {
        // Create a system message with search results
        const searchContext = `\n\nWeb Search Results:\n${searchResults
          .map(
            (result) =>
              `- ${result.title}: ${result.content}${result.url ? ` (${result.url})` : ""}`,
          )
          .join(
            "\n",
          )}\n\nUse these search results to provide current information in your response.`;

        // Add search context to the last user message
        messagesToSend[messagesToSend.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + searchContext,
        };
      }
    }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messagesToSend,
      max_tokens,
      temperature,
    }),
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
