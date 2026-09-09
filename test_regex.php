<?php
$lines = ["NIK : 1607032605010001", "Nama : SATRIO MUSLIM WIBOWO", "| Nama : BUDI", "PROVINSI"];
foreach ($lines as $line) {
    if (preg_match('/(?:^|[^A-Za-z])N[aA][rmn][aAuo]\s*[:\-\s]\s*(.+)$/i', $line, $m)) {
        echo "Matched Nama: " . $m[1] . "\n";
    }
}
