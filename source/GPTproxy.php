<?php
//get the api key 
include('config.php'); 

// Set headers for Server-Sent Events
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('X-Accel-Buffering: no'); // Disable Nginx buffering

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('HTTP/1.1 405 Method Not Allowed');
    exit();
}

//receive input to forward
$input = file_get_contents('php://input');

//read EMMA text and add it to the body
$emma = file_get_contents('../data/EMMA.txt');

$json = json_decode($input, true);
$json['instructions'] = $emma;
$body = json_encode($json);

// Initialize streaming cURL
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => 'https://api.openai.com/v1/responses',           
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $api_key    
	],
    CURLOPT_TIMEOUT => 60
]);

// Execute and return the response
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Send the response back to your JavaScript
http_response_code($http_code);
echo $response;
?>