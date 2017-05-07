var isConnectToDemoAgent = true; 
var shouldSystemPrompt = true;
var lastOutput = "";
$(function() {
  $('#serverToggle').change(function() {
    isConnectToDemoAgent = this.checked;
    if(isConnectToDemoAgent){
      document.title = "Hotel Agent";
    } else {
      document.title = "Server Test";
    }
    console.log("Agent Switched: Connect to DemoAgent? " + isConnectToDemoAgent);
  });

  // Capture the send button clicking
  $('.send_message').click(function (e) {
    var userInput = getMessageText()
    sendAndWaitToOutputAPIAI(userInput);
  });

  // Capture the ENTER button clicking
  $('.message_input').keyup(function (e) {
    if (e.which === 13) {
      var userInput = getMessageText()
      sendAndWaitToOutputAPIAI(userInput);  
    }
  });


  // The pretty history logging
  var Message;
  Message = function (arg) {
    this.text = arg.text, this.message_side = arg.message_side;
    this.draw = function (_this) {
      return function () {
        var $message;
        $message = $($('.message_template').clone().html());
        $message.addClass(_this.message_side).find('.text').html(_this.text);
        $('.messages').append($message);
        return setTimeout(function () {
          return $message.addClass('appeared');
        }, 0);
      };
    }(this);
    return this;
  };

  // The pretty history logging (image)
  var Message_image;
  Message_image = function (arg) {
    this.text = arg.text, this.message_side = arg.message_side, this.imageAddr = arg.imageAddr;  // bring in the image address
    this.draw = function (_this) {
      return function () {
        var $message;
        $message = $($('.message_template_image').clone().html());
        $message.addClass(_this.message_side).find('.text').html(_this.text);
        $message.find('.image').attr('src',_this.imageAddr);   // Change the image address
        $('.messages').append($message);
        return setTimeout(function () {
          return $message.addClass('appeared');
        }, 0);
      };
    }(this);
    return this;
  };

  // Internal functions for getting input text and sending text
  var getMessageText, message_side, sendMessage;
  getMessageText = function () {
    var $message_input;
    $message_input = $('.message_input');
    return $message_input.val();
  };
  sendMessage = function (text, message_side, image = false, imageAddr = "") {

      var $messages, message;
      if (text.trim() === '') {
        return;
      }
      $('.message_input').val('');
      $messages = $('.messages');
      
      // Handle both text and image cases
      if (image) {
        message = new Message_image({
          text: text,
          message_side: message_side,
          imageAddr: imageAddr
        });
      } else {
        message = new Message({
          text: text,
          message_side: message_side
        });
      }
      
      message.draw();
      return $messages.animate({ scrollTop: $messages.prop('scrollHeight') }, 300);

  };


  /**
  * Display the user input and send it to api.ai and then
  * waiting on the response to produce voice output.
  * @method sendAndWaitToOutputAPIAIs
  * @param {String} uesrInputToSend Text input from the front end to be sent.
  */
  function sendAndWaitToOutputAPIAI(userInputToSend, toShow = true){
    // Show user input
    //display_speech(userInputToSend);
    if(toShow)
      sendMessage(userInputToSend, 'right');

    // Notify the server to send api.ai this input
    socket.emit("send_to_apiai", [userInputToSend, isConnectToDemoAgent]);
    sysCanOutput = true;
    // Wait for the response from the server along with the response from api.ai
    socket.on("response_from_apiai", function(response){
      console.log("response_from_apiai: " + response.message);
      if(lastOutput!= response.message && response.message == "Your booking of the restaurant is confirmed.") sysCanOutput=true;
      // Speak out the response
      produce_voice_output(response);
      
    });
  }

  /**
  * Display the text upon the given sentence.
  * @method display_speechs
  * @param {String} msg Text to be displayed to the user.
  */
  function display_speech(msg) {
    document.getElementById("display_text").innerHTML = msg;
  }


  /**
  * Produce voice output.
  * Synthesis support. Make your web apps talk!
  * @method produce_voice_output
  * @param {String} text Text to be output as sound.
  */
  function produce_voice_output(obj) {
    if(sysCanOutput){
      // Wait for next user speech initiative
      sysCanOutput = false;
      lastOutput = obj.message;
      var text = obj.message;
      var imageAddr = obj.image;
      // Check whether the browser support the synthesisor
      if ('speechSynthesis' in window) {
        var sysOutput = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(sysOutput);
        //display_speech(text);

        // This is for fun
        // To embed the image display feature
        // wait for further implementation on api.ai
        // to hook it on
        if (imageAddr!=""){
          // True for image display
          sendMessage(text, 'left', true, imageAddr);
        } else {
          sendMessage(text, 'left');
        }


      } else {
        display_speech("Google API not supported");
      }
    }
  }



  // Stop the synthesisor from speaking without user initiative
  var sysCanOutput = false;

  // Create the socket for communication
  var socket = io();


  // The speech recognition part
  if (annyang) {

    // Tell KITT to use annyang
    SpeechKITT.annyang();
    // Define a stylesheet for KITT to use
    SpeechKITT.setStylesheet('//cdnjs.cloudflare.com/ajax/libs/SpeechKITT/0.3.0/themes/flat.css');
    // Render KITT's interface
    SpeechKITT.vroom();


    // Notify the server that speech recognition is ready
    socket.emit("annyang", "Speech Recognition is ready");

    // Display the user input
    annyang.addCallback('result', function(userSaid) {
      // Catch the highest possible input from user
      var userInput = userSaid[0];
      sendAndWaitToOutputAPIAI(userInput);
    });

    // Start listening
    annyang.start();
    if(shouldSystemPrompt){
      userInput = "Ivana is fat.";
      sendAndWaitToOutputAPIAI(userInput, false);
    }
  } else {
    socket.emit("annyang", "Speech Recognition is closed");
  }

  // Uber communications
  socket.on("uber profile", function(response){
    alert('catch');
    //$('#uber_button').src = profile.picture;
    $("#uber_button").attr("src", response.picture);
    $("#uber_name").text(response.first_name + " " + response.last_name);
    //$("#uber_verified").text("[Verified by Uber]");
    //alert(response.picture);

  });


}); // The end of jQuery onLoad()