import 'react-toastify/dist/ReactToastify.css'
import '@styles/globals.css'
import {ToastContainer} from "react-toastify";

const Noop = ({ children }) => <>{children}</>

export default function App({ Component, pageProps }) {
    const Layout = Component.Layout ?? Noop

    return (
        <Layout>
            <ToastContainer />
            <Component {...pageProps} />
        </Layout>
    )
}
