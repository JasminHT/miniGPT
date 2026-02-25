<?php
echo "PHP Version: " . phpversion() . "<br>";
echo "Loaded php.ini: " . php_ini_loaded_file() . "<br>";
echo "SAPI: " . php_sapi_name() . "<br>";

echo "Extension dir: " . ini_get('extension_dir') . "<br>";
echo "Loaded modules:<br>";
print_r(get_loaded_extensions());

phpinfo();