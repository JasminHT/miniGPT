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

chat.prepMessageGPT5 = async function (prompt) {
  
  chat.body.model = "gpt-5-nano"
  chat.body.input = [ ]
  chat.body.input.unshift(
    { role: "user", content: [ {"type": "input_text", "text": prompt} ] } 
  )

  //middle messages: previous conversation
  for (let i=chat.history.length-1; i>=0&&i>(chat.history.length-3); i--) {
    chat.body.input.unshift( { role:'assistant', content: [ {"type": "input_text","text": chat.history[i].result }]});
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

  await chat.prepMessage(prompt)

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
  while (true) {
    const { done, value } = await reader.read();

    if (done) return chat.oncomplete(chat.result);
    
    const lines = (chat.value=value).split('\n');

    for (let i in lines) {
      if (lines[i].length === 0) continue;     // ignore empty message
      if (lines[i].startsWith(':')) continue;  // ignore comment message
      if (lines[i] === 'data: [DONE]') return chat.oncomplete(chat.result); // end of message    

      try {//not all tokens received are properly-formatted strings, just ignore the errors
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
