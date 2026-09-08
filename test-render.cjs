const React = require('react');
const ReactDOMServer = require('react-dom/server');

// We need to bypass CSS imports and other non-JS things
require.extensions['.css'] = () => {};

// Mock inertia
jest = { mock: () => {} };
const inertia = {
    Link: ({children}) => React.createElement('a', null, children),
    Head: () => React.createElement('title', null, 'Head'),
    usePage: () => ({ url: '/admin/dashboard' }),
    useForm: () => ({ data: {}, setData: ()=>{}, post: ()=>{}, processing: false, reset: ()=>{}, errors: {} })
};
require('module').Module._cache[require.resolve('@inertiajs/react')] = {
    id: require.resolve('@inertiajs/react'),
    filename: require.resolve('@inertiajs/react'),
    loaded: true,
    exports: inertia
};

// Register ts-node
require('ts-node').register({
    compilerOptions: {
        module: 'commonjs',
        jsx: 'react',
        esModuleInterop: true,
        paths: {
            "@/*": ["./resources/js/*"]
        }
    }
});

// Load the Dashboard component
try {
    const Dashboard = require('./resources/js/pages/Admin/Dashboard.tsx').default;
    const html = ReactDOMServer.renderToString(React.createElement(Dashboard, {
        stats: {
            total_rooms: 10,
            available_rooms: 5,
            occupied_rooms: 5,
            active_tenants: 5
        }
    }));
    console.log("Dashboard Render Success!");
} catch (e) {
    console.error("Dashboard Error:", e);
}
