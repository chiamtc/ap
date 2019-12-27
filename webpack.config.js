const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');
const AppName = "Playground";

module.exports = {
    entry: './src/app/index.js',
    output: {
        path: __dirname + "/stage",
        filename: 'app.bundle.[chunkhash].js',
        publicPath: '/'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: 'babel-loader'
            }
        ]
    },

    devServer: {
        contentBase: __dirname + "/dist",
        compress: false,
        port: 9000,
        host: "0.0.0.0",
        stats: "errors-only",
        historyApiFallback: true // enable this to server index html to any invalid path
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: AppName,
            template: "./src/index.html",
            filename: "./index.html",
            minify: {
                // Build and minify all the scripts
                collapseWhitespace: true,
                collapseInlineTagWhitespace: true,
                minifyCSS: true,
                minifyJS: true
            }
        })
    ]
}
