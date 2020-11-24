const path = require('path');
const Webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.tsx',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.ttf']
  },
  plugins: [
    new Webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({
      template: 'public/index.html'
    })
  ],
  devServer: {
    publicPath: "/",
    contentBase: "./public",
    hot: true
  },
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        use: [
          {loader: 'workerize-loader'},
          {loader: 'babel-loader', options: { presets: ['@babel/preset-env']} }
        ]
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'ts-loader'
      },
      {
        test: /\.s?css$/,
        loaders: ['style-loader', 'css-loader', 'sass-loader'],
        include: [
          path.resolve(__dirname, 'src/ui/style'),
          path.resolve(__dirname, 'node_modules/react-tabs/style/react-tabs.css')
        ]
      },
      {
        test: /\.ttf$/,
        loader: 'file-loader',
        options: {
          name: './font/[hash].[ext]',
        }
      },
      {
        test: /\.png$/,
        loader: 'file-loader',
        options: {
          name: './image/[hash].[ext]',
        },
        include: [ path.resolve(__dirname, 'src/res/images') ]
      }
    ]
  }
};