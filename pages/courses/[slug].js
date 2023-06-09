import {CourseHero, Curriculum, Keypoints} from "components/ui/course";
import {Modal} from "components/ui/common";
import {BaseLayout} from "components/ui/layout";
import {getAllCourse} from "@content/courses/fetcher";
import {useAccount, useOwnedCourse} from "@components/hooks/web3";
import {Message} from "@components/ui/common";
import {useWeb3} from "@components/providers";


export default function Course({course}) {
    const { isLoading } = useWeb3()
    const { account } = useAccount()
    const { ownedCourse } = useOwnedCourse(course, account.data)
    const courseState = ownedCourse.data?.state

    const isLocked = !courseState ||
        courseState === "purchased" ||
        courseState === "deactivated"

    return (
        <div className="py-4">
            <CourseHero
                hasOwner={!!ownedCourse.data}
                title={course.title}
                description={course.description}
                image={course.coverImage}
            />
            <Keypoints
                points={course.wsl}
            />
            {
                courseState && <div className="max-w-5xl mx-auto">
                    {
                        courseState === 'purchased' &&
                        <Message type="warning">
                            Course is purchased and waiting for activation. Process can take up to 24 hours.
                            <i className="block font-normal">
                                In case of any questions, please contact contact@triformine.dev
                            </i>
                        </Message>
                    }
                    {
                        courseState === 'activated' &&
                        <Message type="success">
                            We wishes you a pleasant learning experience.
                        </Message>
                    }
                    {
                        courseState === 'deactivated' &&
                        <Message type="danger">
                            Course has been deactivated, due to incorrect payment. The functionality to watch the course has been temporarily disabled.
                            <i className="block font-normal">
                                Please contact contact@triformine.dev
                            </i>
                        </Message>
                    }
                </div>
            }
            <Curriculum
                isLoading={isLoading}
                locked={isLocked}
                courseState={courseState}
            />
            <Modal />
        </div>
    )
}

export function getStaticPaths() {
    const { data } = getAllCourse()

    return {
        paths: data.map(c => ({
            params: {
                slug: c.slug
            }
        })),
        fallback: false
    }
}

export const getStaticProps = ({params}) => {
    const {data} = getAllCourse()
    const course = data.filter(c => c.slug === params.slug)[0]

    return {
        props: {
            course: course
        }
    }
}


Course.Layout = BaseLayout
