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
chat.prepMessageGpt3 = async function (prompt) {

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
chat.prepMessage = async function (prompt) {
  
  chat.body.model = "gpt-5"
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
  const response = await fetch("/miniGPT/data/EMMA.txt");
  const EMMA = await response.text();
  chat.body.instructions = EMMA;

}


chat.stream = async function(prompt) {

  chat.body.stream = true 
  chat.result = ''
  chat.controller = new AbortController();
  const signal = chat.controller.signal

  try {

    await chat.prepMessage(prompt)

    // Step 1: Send request to GPT proxy
    const gptResponse = await fetch("GPTproxy.php", {
      method: 'POST',
      body: JSON.stringify(chat.body),
      signal
    });
    
    // Step 2: Check for errors
    if (!gptResponse.ok) {
      if (gptResponse.status == 401) throw new Error('401 Unauthorized, invalid API Key');
      throw new Error('failed to get data, error status ' + gptResponse.status);
    }
    
    // Step 3: Display the response
    const reader = gptResponse.body.pipeThrough(new TextDecoderStream()).getReader();
    await chat.processStream(reader);
    
  } catch (error) {
    chat.onError(error);
  }
}

chat.processStream = async function(reader) {
  
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) return;
    //if (done) return chat.onComplete(chat.result);

    // We capture complete parts and put the last (incomplete) part back in the buffer
    buffer += value;
    const parts = buffer.split("\n\n");
    buffer = parts.pop(); 

    //process each part into lines
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

      chat.onResponse(event, JSON.parse(data));


    }
  }
}


chat.onResponse = function(event, data) {
  switch (event) {
    case "response.output_text.delta":
      chat.result += data.delta;
      chat.onMessage(chat.result);
      break;

    case "response.completed":
      chat.onComplete(chat.result);
      break;

    case "response.error":
      console.error(data);
      break;
  }
}

// default error handle
chat.onError = (error) => { alert(error);  };

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
