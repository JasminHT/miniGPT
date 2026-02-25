<?php

include('config.php');

// Get the parameters from the request
$api_url  = "https://api.openai.com/v1/chat/completions";
$headers =  $headers = [
			    'Authorization: Bearer ' . $api_key,
			    'Content-Type: application/json'
			];
$body = file_get_contents('php://input');


// Initialize cURL
$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Execute and return the response
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Send the response back to your JavaScript
http_response_code($http_code);
echo $response;
?>