/***************************************************************************
* vanilla-chatgpt.js - chat library for openai-chatgpt
* last updated on 2023/03/28, v0.60, basic chat, responsive, print-friendly, export.
*
* Copyright (c) 2023, Casualwriter (MIT Licensed)
* https://github.com/casualwriter/vanilla-chatgpt
*****************************************************************************/

const chat = (id) => window.document.getElementById(id);

// Set the API endpoint URL
chat.model = "gpt-3.5-turbo"
chat.body  = { model: chat.model }
chat.history = []

// stream result from openai using Conversations API
chat.prepMessage = async function (prompt) {

  //last message: user prompt
  chat.body.messages = [ { role: "user", content: prompt} ]

  //middle messages: previous conversation
  for (let i=chat.history.length-1; i>=0&&i>(chat.history.length-3); i--) {
    chat.body.messages.unshift( { role:'assistant', content: chat.history[i].result } );
    chat.body.messages.unshift( { role:'user', content: chat.history[i].prompt } );
  }

  // first message: load the system prompt
  const response = await fetch("http://localhost/miniGPT/data/EMMA.txt");
  const EMMA = await response.text();
  chat.body.messages.unshift({role: 'system', content: EMMA});
}

//stream result from openai using Responses API
chat.prepMessageGPT5 = async function (prompt) {
  
  chat.body.model = "gpt-5-nano"
  chat.body.input = [ ]

  //last message: user prompt
  chat.body.input.unshift(
    { role: "user", content: [ {"type": "input_text", "text": prompt} ] } 
  )

  //middle messages: previous conversation
  for (let i=chat.history.length-1; i>=0&&i>(chat.history.length-3); i--) {
    chat.body.input.unshift( { role:'assistant', content: [ {"type": "output_text","text": chat.history[i].result }]});
    chat.body.input.unshift( { role:'user', content: [ { "type": "input_text", "text": chat.history[i].prompt }]});
  }

  // first message: load the system prompt
  const response = await fetch("http://localhost/miniGPT/data/EMMA.txt");
  const EMMA = await response.text();
  chat.body.instructions = EMMA;

}


chat.stream = async function(prompt) {

  chat.body.stream = true 
  chat.result = ''
  chat.controller = new AbortController();
  const signal = chat.controller.signal

  await chat.prepMessageGPT5(prompt)

  try {

    // Step 2: Send request to GPT proxy
    const gptResponse = await fetch("GPTproxy.php", {
      method: 'POST',
      body: JSON.stringify(chat.body),
      signal
    });
    
    // Step 3: Check for errors
    if (!gptResponse.ok) {
      if (gptResponse.status == 401) throw new Error('401 Unauthorized, invalid API Key');
      throw new Error('failed to get data, error status ' + gptResponse.status);
    }
    
    // Step 4: Display the response
    const reader = gptResponse.body.pipeThrough(new TextDecoderStream()).getReader();
    await chat.processStream(reader);
    
  } catch (error) {
    chat.onerror(error);
  }
}

chat.processStream = async function(reader) {
  
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) return;
    //if (done) return chat.oncomplete(chat.result);

    // Split complete SSE messages
    buffer += value;
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); // last part may be incomplete, so skip it for now

    //split the message into individual events
    for (const part of parts) {
      if (!part.trim()) continue;

      const lines = part.split("\n");

      let event = null;
      let data = null;

      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data = line.slice(5).trim();
        }
      }

      if (!data || data === "[DONE]") continue;

      const json = JSON.parse(data);

      chat.handleResponseEvent(event, json);


    }
  }
}


chat.handleResponseEvent = function(event, json) {
  switch (event) {
    case "response.output_text.delta":
      chat.result += json.delta;
      chat.onmessage(chat.result);
      break;

    case "response.completed":
      chat.oncomplete(chat.result);
      break;

    case "response.error":
      console.error(json);
      break;
  }
}

// default error handle
chat.onerror = (error) => { alert(error);  };

// clear API key when logout
chat.logout = () => { 
  if (confirm( 'Logout and clear API Key?')) localStorage.clear();
}

// export conversation
chat.export = (fname) => {
  const link = document.createElement('a');
  link.href = 'data:text/plain;charset=utf-8,' 
  chat.history.forEach( (x) => { 
    link.href += encodeURIComponent('### '+x.prompt+'\n\n'+x.result+'\n\n') 
  } );  
  link.download = fname||('chat-'+new Date().toISOString().substr(0,16))+'.md';
  link.click();
} 
