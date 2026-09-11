<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Water reminder scheduler
    |--------------------------------------------------------------------------
    |
    | Controls whether the automatic water reminder command is registered in
    | routes/console.php. Keep this enabled only after SMTP delivery has been
    | verified via the Test Email button on /admin/water.
    |
    */
    'scheduler_enabled' => env('WATER_SCHEDULER_ENABLED', true),
];