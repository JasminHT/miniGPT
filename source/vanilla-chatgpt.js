/*****************************************************************************
* vanilla-chatgpt.js - chat library for openai-chatgpt
* last updated on 2023/03/28, v0.60, basic chat, responsive, print-friendly, export.
*
* Copyright (c) 2023, Casualwriter (MIT Licensed)
* https://github.com/casualwriter/vanilla-chatgpt
*****************************************************************************/

const chat = (id) => window.document.getElementById(id);

// Set the API endpoint URL
//chat.model = "gpt-5-mini"
//chat.model = "gpt-5-nano"
chat.model = "gpt-3.5-turbo"
chat.body  = { model: chat.model, temperature: 0.8 }
chat.history = []

// stream result from openai
chat.stream = function (prompt) {

  //last message: user prompt
  chat.body.messages = [ { role: "user", content: prompt} ]

  //middle messages: previous conversation
  for (let i=chat.history.length-1; i>=0&&i>(chat.history.length-3); i--) {
    chat.body.messages.unshift( { role:'assistant', content: chat.history[i].result } );
    chat.body.messages.unshift( { role:'user', content: chat.history[i].prompt } );
  }

  chat.sendMessageWithSystemPrompt()
  
}


chat.sendMessageWithSystemPrompt = async function() {

  chat.body.stream = true 
  chat.result = ''
  chat.controller = new AbortController();
  const signal = chat.controller.signal

  try {
    // Step 1: Load the system prompt
    const response = await fetch("http://localhost/miniGPT/data/EMMA.txt");
    const systemText = await response.text();
    chat.body.messages.unshift({role: 'system', content: systemText});
    
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
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      chat.oncomplete(chat.result);
      break;
    }
    
    const lines = (chat.value = value).split('\n');
    
    for (let i in lines) {
      if (lines[i].length === 0) continue;
      if (lines[i].startsWith(':')) continue;
      if (lines[i] === 'data: [DONE]') {
        chat.oncomplete(chat.result);
        return;
      }
      
      try {
        chat.json = JSON.parse(lines[i].substring(6));
      } catch {
        chat.json = "";
      }
      
      if (chat.json.choices) {
        let delta = chat.json.choices[0].delta.content || '';
        chat.result += delta;
      }
    }
    
    chat.onmessage(chat.result);
  }
}
    
// send prompt to openai API (not used in vanilla-chatGPT)
chat.send = async function (prompt) {
 
  chat.body.stream = false 
  chat.body.messages = [ { role: "user", content: prompt} ]
  chat.result = ''
  chat.controller = new AbortController();
  const signal = chat.controller.signal
   
  fetch( "GPTproxy.php", 
          { method:'POST', 
            body: JSON.stringify(chat.body), 
            signal } )
  .then(response => response.json() )
  .then(json => {
     if ((chat.json = json).choices) {
        chat.result = json.choices[0].message.content
        chat.onmessage(chat.result)
        chat.oncomplete(chat.result)
     }	 
  })
  .catch(error => console.error(error));
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
